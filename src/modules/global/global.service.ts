import { Injectable } from '@nestjs/common';
import { CreateGlobalDto } from './dto/create-global.dto';
import { UpdateGlobalDto } from './dto/update-global.dto';
import { dbMssql } from 'src/common/utils/db';
import { UtilsService } from 'src/utils/utils.service';
import { tableToServiceMap, ValidationCheck, ValidationResult } from '.';
import { ModuleRef } from '@nestjs/core';
import { DateTime } from 'luxon';

@Injectable()
export class GlobalService {
  constructor(
    private readonly utilsService: UtilsService,
    private moduleRef: ModuleRef,
  ) {}
  // async validationDelete(checks: any[], trx: any): Promise<any[]> {
  //   const results: any[] = [];

  //   for (const check of checks) {
  //     try {
  //       const moduleService = tableToServiceMap[tableName];
  //       console.log(moduleService);
  //       if (moduleService) {
  //         // Menggunakan ModuleRef untuk mendapatkan instance dari service secara dinamis
  //         const serviceInstance = await this.moduleRef.resolve(moduleService);

  //         if (serviceInstance && serviceInstance.cekValidasi) {
  //           const validationResult = await serviceInstance.cekValidasi(
  //             check,
  //             trx,
  //           );
  //           results.push(validationResult);
  //         }
  //       }

  //       // 1. Validasi Global: Memeriksa apakah ada data yang digunakan dalam tabel tersebut
  //       const globalValidationResult = await this.validateGlobal(check, trx);
  //       results.push(globalValidationResult);
  //     } catch (error: any) {
  //       results.push({
  //         tableName: tableName,
  //         fieldName: fieldName,
  //         fieldValue: check.fieldValue,
  //         status: 'failed',
  //         message: `Error saat validasi ${check.fieldName}=${check.fieldValue}: ${error?.message ?? error}`,
  //       });
  //     }
  //   }

  //   return results;
  // }
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

  async forceEdit(
    tableName: string,
    tableId: number,
    editingBy: string,
    trx: any,
  ) {
    try {
      // UTC sekarang
      const now = new Date();
      const nowMs = now.getTime();
      const utcNowIso = now.toISOString(); // simpan ini ke DB

      console.log('[forceEdit] params:', {
        tableName,
        tableId,
        editingBy,
        nowIso: utcNowIso,
      });

      const existingLock = await trx('locks')
        .where('table', tableName)
        .andWhere('tableid', tableId)
        .first();
      if (existingLock && existingLock.editing_by === editingBy) {
        return {
          status: 'success',
          message: `Data pada table ${tableName} dengan ID ${tableId} sudah terkunci oleh Anda.`,
        };
      }

      if (!existingLock) {
        try {
          await trx('locks').insert({
            table: tableName,
            tableid: tableId,
            editing_by: editingBy,
            editing_at: utcNowIso, // <-- simpan UTC ISO
            info: `Data pada table ${tableName} dengan ID ${tableId} sedang diedit.`,
            modifiedby: editingBy,
            created_at: utcNowIso, // <-- simpan UTC ISO
            updated_at: utcNowIso, // <-- simpan UTC ISO
          });

          return {
            status: 'success',
            message: `Data pada table ${tableName} dengan ID ${tableId} berhasil dikunci untuk edit.`,
          };
        } catch (error) {
          console.error('[forceEdit] Error saat insert lock:', error);
          return {
            status: 'failed',
            message: `Terjadi kesalahan saat menyimpan data: ${error.message}`,
          };
        }
      }

      // --- cek expired pakai epoch UTC ---
      const lockedAtMs = new Date(existingLock.editing_at).getTime(); // Date dari driver sudah UTC-safe
      const diffMs = nowMs - lockedAtMs;
      const FIVE_MIN_MS = 5 * 60 * 1000;
      const expired = diffMs >= FIVE_MIN_MS;

      console.log('[forceEdit] timeCheck:', {
        expired,
        nowMs,
        lockedAtMs,
        diffMs,
        nowIso: utcNowIso,
        lockedAtIso: new Date(lockedAtMs).toISOString(),
      });

      if (expired) {
        // timpa lock lama
        try {
          await trx('locks')
            .where({ table: tableName, tableid: tableId })
            .update({
              editing_by: editingBy,
              editing_at: utcNowIso, // <-- update pakai UTC ISO
              info: `Data pada table ${tableName} dengan ID ${tableId} sedang diedit oleh ${editingBy}.`,
              modifiedby: editingBy,
              updated_at: utcNowIso, // <-- UTC ISO
            });

          return {
            status: 'success',
            message: `Lock lama (>5 menit) ditimpa. Sekarang ${editingBy} mengunci data ${tableName}#${tableId}.`,
          };
        } catch (error) {
          console.error(
            '[forceEdit] Error saat update lock (overwrite):',
            error,
          );
          return {
            status: 'failed',
            message: `Gagal menimpa lock lama: ${error.message}`,
          };
        }
      } else {
        // masih aktif → kasih sisa MENIT
        const remainingMs = FIVE_MIN_MS - Math.max(0, diffMs); // guard kalau diff negatif
        const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));

        return {
          status: 'failed',
          message: `Data sedang diedit oleh ${existingLock.editing_by}. Coba lagi dalam ~${remainingMin} menit.`,
        };
      }
    } catch (error) {
      console.error('[forceEdit] Unexpected error:', error);
      return {
        status: 'failed',
        message: `Unexpected error: ${error.message}`,
      };
    }
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
