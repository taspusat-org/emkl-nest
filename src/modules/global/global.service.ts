import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateGlobalDto } from './dto/create-global.dto';
import { UpdateGlobalDto } from './dto/update-global.dto';
import { dbMssql } from 'src/common/utils/db';
import { UtilsService } from 'src/utils/utils.service';
import { tableToServiceMap, ValidationCheck, ValidationResult } from '.';
import { ModuleRef } from '@nestjs/core';
import { DateTime } from 'luxon';
import * as bcrypt from 'bcrypt';

@Injectable()
export class GlobalService {
  constructor(
    private readonly utilsService: UtilsService,
    private moduleRef: ModuleRef,
  ) {}

  async checkData(data: any, trx: any) {
    // Validasi 1: Cek jika transaksi_id adalah array
    if (!Array.isArray(data.transaksi_id) || data.transaksi_id.length === 0) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Transaksi ID tidak valid atau tidak ada.',
        isValid: false,
      };
    }

    try {
      // ========================================
      // AMBIL DATA DARI TABLE UTAMA
      // ========================================
      const mainData = await trx(data.tableName)
        .whereIn('id', data.transaksi_id)
        .forUpdate(); // LOCK ROWS untuk mencegah concurrent modification

      // Jika tidak ada data ditemukan
      if (!mainData || mainData.length === 0) {
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Data tidak ditemukan.',
          isValid: false,
        };
      }

      // ========================================
      // VALIDASI BERDASARKAN STATUS
      // ========================================
      if (data.text === 'AKTIF') {
        // Validasi 2a: Check apakah ada data yang sudah AKTIF di table utama
        const checkValidation = mainData.filter(
          (row: any) => row.statusaktif === data.value,
        );

        if (checkValidation && checkValidation.length > 0) {
          const namaList = checkValidation
            .map((row: any) => row.nama)
            .join(', ');
          return {
            status: HttpStatus.BAD_REQUEST,
            message: `Data ${namaList} sudah berstatus AKTIF. Proses tidak bisa dilanjutkan.`,
            isValid: false,
            conflictData: checkValidation,
          };
        }

        // Validasi 2b: Check apakah sudah ada di statuspendukung dengan status AKTIF
        const checkStatusPendukung = await trx('statuspendukung')
          .whereIn('transaksi_id', data.transaksi_id)
          .where('statuspendukung', data.value);

        if (checkStatusPendukung && checkStatusPendukung.length > 0) {
          const namaList = mainData.map((row: any) => row.nama).join(', ');
          return {
            status: HttpStatus.BAD_REQUEST,
            message: `Data ${namaList} sudah berstatus AKTIF di status pendukung. Proses tidak bisa dilanjutkan.`,
            isValid: false,
            conflictData: checkStatusPendukung,
          };
        }
      } else {
        // Validasi 3: Check untuk status non-AKTIF (APPROVED)
        const checkStatusPendukung = await trx('statuspendukung')
          .whereIn('transaksi_id', data.transaksi_id)
          .where('statuspendukung', data.value);

        if (checkStatusPendukung && checkStatusPendukung.length > 0) {
          const namaList = mainData.map((row: any) => row.nama).join(', ');
          return {
            status: HttpStatus.BAD_REQUEST,
            message: `Data ${namaList} sudah berstatus APPROVED. Proses tidak bisa dilanjutkan.`,
            isValid: false,
            conflictData: checkStatusPendukung,
          };
        }
      }

      // ========================================
      // VALIDASI TAMBAHAN (OPTIONAL)
      // ========================================

      // Check apakah semua transaksi_id valid dan ada di database
      const validIds = mainData.map((row: any) => row.id);
      const invalidIds = data.transaksi_id.filter(
        (id: any) => !validIds.includes(id),
      );

      if (invalidIds.length > 0) {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `Transaksi ID ${invalidIds.join(', ')} tidak ditemukan.`,
          isValid: false,
          invalidIds: invalidIds,
        };
      }

      // Jika semua validasi lolos
      return {
        status: HttpStatus.OK,
        message: 'Data valid dan siap untuk diproses.',
        isValid: true,
        mainData: mainData, // Return main data untuk digunakan jika diperlukan
      };
    } catch (error) {
      console.error('Error validating data:', error);
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Gagal melakukan validasi data.',
        isValid: false,
        error: error.message,
      };
    }
  }
  async approval(data: any, trx: any) {
    const created_at = this.utilsService.getTime();
    const updated_at = this.utilsService.getTime();

    // Cek jika transaksi_id adalah array
    if (!Array.isArray(data.transaksi_id) || data.transaksi_id.length === 0) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Transaksi ID tidak valid atau tidak ada.',
      };
    }

    // Payload umum untuk insert ke statuspendukung
    const payloadBase = {
      statusdatapendukung: data.id,
      statuspendukung: data.value,
      keterangan: data.keterangan,
      created_at: created_at,
      updated_at: updated_at,
    };

    try {
      // ========================================
      // STEP 1: LOCK DATA DI TABLE UTAMA
      // ========================================
      const lockedMainData = await trx(data.tableName)
        .whereIn('id', data.transaksi_id)
        .forUpdate(); // LOCK ROWS untuk mencegah concurrent modification

      if (data.text === 'AKTIF') {
        // Check validation pada data yang sudah di-lock
        const checkValidation = lockedMainData.filter(
          (row: any) => row.statusaktif === data.value,
        );

        const checkStatusPendukung = await trx('statuspendukung')
          .whereIn('transaksi_id', data.transaksi_id)
          .where('statuspendukung', data.value);

        if (checkValidation && checkValidation.length > 0) {
          const namaList = checkValidation
            .map((row: any) => row.nama)
            .join(', ');
          return {
            status: HttpStatus.BAD_REQUEST,
            message: `Data ${namaList} sudah berstatus AKTIF. Proses tidak bisa dilanjutkan.`,
          };
        } else if (checkStatusPendukung && checkStatusPendukung.length > 0) {
          const namaList = lockedMainData
            .map((row: any) => row.nama)
            .join(', ');
          return {
            status: HttpStatus.BAD_REQUEST,
            message: `Data ${namaList} sudah berstatus AKTIF di status pendukung. Proses tidak bisa dilanjutkan.`,
          };
        } else {
          // Update statusaktif (data sudah di-lock)
          await trx(data.tableName)
            .update({ statusaktif: data.value, updated_at })
            .whereIn('id', data.transaksi_id);

          // Looping untuk insert/update ke statuspendukung
          for (const transaksiId of data.transaksi_id) {
            // Cek apakah data sudah ada (dengan locking)
            const existing = await trx('statuspendukung')
              .where({
                statusdatapendukung: data.id,
                transaksi_id: transaksiId,
              })
              .forUpdate() // LOCK ROW SPECIFIC
              .first();

            if (existing) {
              // Jika ADA: UPDATE
              await trx('statuspendukung')
                .where({
                  statusdatapendukung: data.id,
                  transaksi_id: transaksiId,
                })
                .update({
                  statuspendukung: data.value,
                  keterangan: data.keterangan,
                  updated_at,
                });
            } else {
              // Jika TIDAK ADA: INSERT
              await trx('statuspendukung').insert({
                ...payloadBase,
                transaksi_id: transaksiId,
              });
            }
          }
        }
      } else {
        // Branch untuk non-AKTIF status
        const checkStatusPendukung = await trx('statuspendukung')
          .whereIn('transaksi_id', data.transaksi_id)
          .where('statuspendukung', data.value);

        if (checkStatusPendukung && checkStatusPendukung.length > 0) {
          const namaList = lockedMainData
            .map((row: any) => row.nama)
            .join(', ');
          return {
            status: HttpStatus.BAD_REQUEST,
            message: `Data ${namaList} sudah berstatus APPROVED. Proses tidak bisa dilanjutkan.`,
          };
        } else {
          // Update data di table utama jika diperlukan
          // await trx(data.tableName)
          //   .update({ /* field yang perlu diupdate */ })
          //   .whereIn('id', data.transaksi_id);

          for (const transaksiId of data.transaksi_id) {
            // Lock dan cek data specific
            const existing = await trx('statuspendukung')
              .where({
                statusdatapendukung: data.id,
                transaksi_id: transaksiId,
              })
              .forUpdate() // LOCK ROW SPECIFIC
              .first();

            if (existing) {
              // Jika ADA: UPDATE
              await trx('statuspendukung')
                .where({
                  statusdatapendukung: data.id,
                  transaksi_id: transaksiId,
                })
                .update({
                  statuspendukung: data.value,
                  keterangan: data.keterangan,
                  updated_at,
                });
            } else {
              // Jika TIDAK ADA: INSERT
              await trx('statuspendukung').insert({
                ...payloadBase,
                transaksi_id: transaksiId,
              });
            }
          }
        }
      }

      return {
        status: HttpStatus.OK,
        message: 'Proses approval berhasil dijalankan.',
      };
    } catch (error) {
      console.error('Error processing approval:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process approval');
    }
  }
  async nonApproval(data: any, trx: any) {
    const created_at = this.utilsService.getTime();
    const updated_at = this.utilsService.getTime();

    // Cek jika transaksi_id adalah array
    if (!Array.isArray(data.transaksi_id) || data.transaksi_id.length === 0) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Transaksi ID tidak valid atau tidak ada.',
      };
    }

    // Payload umum untuk insert ke statuspendukung
    const payloadBase = {
      statusdatapendukung: data.id,
      statuspendukung: data.value,
      keterangan: data.keterangan,
      created_at: created_at,
      updated_at: updated_at,
    };

    try {
      // ========================================
      // STEP 1: LOCK DATA DI TABLE UTAMA
      // ========================================
      const lockedMainData = await trx(data.tableName)
        .whereIn('id', data.transaksi_id)
        .forUpdate(); // LOCK ROWS untuk mencegah concurrent modification

      if (data.text === 'AKTIF') {
        // Check validation pada data yang sudah di-lock
        const checkValidation = lockedMainData.filter(
          (row: any) => row.statusaktif === data.value,
        );

        const checkStatusPendukung = await trx('statuspendukung')
          .whereIn('transaksi_id', data.transaksi_id)
          .where('statuspendukung', data.value);

        if (checkValidation && checkValidation.length > 0) {
          const namaList = checkValidation
            .map((row: any) => row.nama)
            .join(', ');
          return {
            status: HttpStatus.BAD_REQUEST,
            message: `Data ${namaList} sudah berstatus NON AKTIF. Proses tidak bisa dilanjutkan.`,
          };
        } else if (checkStatusPendukung && checkStatusPendukung.length > 0) {
          const namaList = lockedMainData
            .map((row: any) => row.nama)
            .join(', ');
          return {
            status: HttpStatus.BAD_REQUEST,
            message: `Data ${namaList} sudah berstatus NON AKTIF di status pendukung. Proses tidak bisa dilanjutkan.`,
          };
        } else {
          // Update statusaktif (data sudah di-lock)
          await trx(data.tableName)
            .update({ statusaktif: data.value, updated_at })
            .whereIn('id', data.transaksi_id);

          // Looping untuk insert/update ke statuspendukung
          for (const transaksiId of data.transaksi_id) {
            // Cek apakah data sudah ada (dengan locking)
            const existing = await trx('statuspendukung')
              .where({
                statusdatapendukung: data.id,
                transaksi_id: transaksiId,
              })
              .forUpdate() // LOCK ROW SPECIFIC
              .first();

            if (existing) {
              // Jika ADA: UPDATE
              await trx('statuspendukung')
                .where({
                  statusdatapendukung: data.id,
                  transaksi_id: transaksiId,
                })
                .update({
                  statuspendukung: data.value,
                  keterangan: data.keterangan,
                  updated_at,
                });
            } else {
              // Jika TIDAK ADA: INSERT
              await trx('statuspendukung').insert({
                ...payloadBase,
                transaksi_id: transaksiId,
              });
            }
          }
        }
      } else {
        // Branch untuk non-AKTIF status
        const checkStatusPendukung = await trx('statuspendukung')
          .whereIn('transaksi_id', data.transaksi_id)
          .where('statuspendukung', data.value);

        if (checkStatusPendukung && checkStatusPendukung.length > 0) {
          const namaList = lockedMainData
            .map((row: any) => row.nama)
            .join(', ');
          return {
            status: HttpStatus.BAD_REQUEST,
            message: `Data ${namaList} sudah berstatus NON APPROVED. Proses tidak bisa dilanjutkan.`,
          };
        } else {
          // Update data di table utama jika diperlukan
          // await trx(data.tableName)
          //   .update({ /* field yang perlu diupdate */ })
          //   .whereIn('id', data.transaksi_id);

          for (const transaksiId of data.transaksi_id) {
            // Lock dan cek data specific
            const existing = await trx('statuspendukung')
              .where({
                statusdatapendukung: data.id,
                transaksi_id: transaksiId,
              })
              .forUpdate() // LOCK ROW SPECIFIC
              .first();

            if (existing) {
              // Jika ADA: UPDATE
              await trx('statuspendukung')
                .where({
                  statusdatapendukung: data.id,
                  transaksi_id: transaksiId,
                })
                .update({
                  statuspendukung: data.value,
                  keterangan: data.keterangan,
                  updated_at,
                });
            } else {
              // Jika TIDAK ADA: INSERT
              await trx('statuspendukung').insert({
                ...payloadBase,
                transaksi_id: transaksiId,
              });
            }
          }
        }
      }

      return {
        status: HttpStatus.OK,
        message: 'Proses non approval berhasil dijalankan.',
      };
    } catch (error) {
      console.error('Error processing non approval:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process non approval');
    }
  }
  async checkUsed(
    tableName: any,
    fieldName: any,
    fieldValue: any,
    trx: any,
  ): Promise<ValidationResult> {
    console.log(tableName, fieldName, fieldValue);
    const recordInUse = await trx(tableName)
      .where(fieldName, fieldValue)
      .first();

    if (recordInUse) {
      return {
        tableName: tableName,
        fieldName: fieldName,
        fieldValue: fieldValue,
        status: 'failed',
        message: `Data ini tidak diizinkan untuk dihapus.`,
      };
    }

    return {
      tableName: tableName,
      fieldName: fieldName,
      fieldValue: fieldValue,
      status: 'success',
      message: 'Data aman untuk dihapus.',
    };
  }

  async approvalNonApproval(data: any, trx: any) {
    try {
    } catch (error) {}
  }

  findAll() {
    return `This action returns all global`;
  }

  findOne(id: number) {
    return `This action returns a #${id} global`;
  }

  update(id: number, updateGlobalDto: UpdateGlobalDto) {
    return `This action updates a #${id} global`;
  }

  remove(id: number) {
    return `This action removes a #${id} global`;
  }
}
