import { Injectable } from '@nestjs/common';
import { CreateGlobalDto } from './dto/create-global.dto';
import { UpdateGlobalDto } from './dto/update-global.dto';
import { dbMssql } from 'src/common/utils/db';
import { UtilsService } from 'src/utils/utils.service';
import { tableToServiceMap, ValidationCheck, ValidationResult } from '.';
import { ModuleRef } from '@nestjs/core';

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
  //       const moduleService = tableToServiceMap[check.tableName];
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
  //         tableName: check.tableName,
  //         fieldName: check.fieldName,
  //         fieldValue: check.fieldValue,
  //         status: 'failed',
  //         message: `Error saat validasi ${check.fieldName}=${check.fieldValue}: ${error?.message ?? error}`,
  //       });
  //     }
  //   }

  //   return results;
  // }
  async validateGlobal(
    check: ValidationCheck,
    trx: any,
  ): Promise<ValidationResult> {
    const recordInUse = await trx(check.tableName)
      .where(check.fieldName, check.fieldValue)
      .first();

    if (recordInUse) {
      return {
        tableName: check.tableName,
        fieldName: check.fieldName,
        fieldValue: check.fieldValue,
        status: 'failed',
        message: `Data ini sedang digunakan dalam ${check.tableName}, tidak dapat dihapus.`,
      };
    }

    return {
      tableName: check.tableName,
      fieldName: check.fieldName,
      fieldValue: check.fieldValue,
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
    // Get the current time
    const datenow = this.utilsService.getTime();

    // Cek apakah sudah ada kombinasi table dan tableid di tabel locks
    const existingLock = await trx('locks')
      .where('table', tableName)
      .andWhere('tableid', tableId)
      .first();

    // Jika sudah ada lock, cek apakah lock lebih dari 5 menit
    if (existingLock) {
      // Calculate if the lock is older than 5 minutes
      const fiveMinutesAgo = new Date(datenow).getTime() - 5 * 60 * 1000; // 5 minutes in milliseconds
      const editingAtTime = new Date(existingLock.editing_at).getTime();

      // Jika lock lebih dari 5 menit, update lock dengan data baru
      if (editingAtTime < fiveMinutesAgo) {
        try {
          await trx('locks')
            .where({ table: tableName, tableid: tableId })
            .update({
              editing_by: editingBy,
              editing_at: datenow, // Waktu saat ini (dari utilsService)
              info: `Data pada table ${tableName} dengan ID ${tableId} sedang diedit oleh ${editingBy}.`,
              modifiedby: editingBy, // Menyimpan siapa yang memodifikasi
              updated_at: datenow, // Waktu saat entri diperbarui
            });

          return {
            status: 'success',
            message: `Data pada table ${tableName} dengan ID ${tableId} berhasil dikunci ulang untuk edit oleh ${editingBy}.`,
          };
        } catch (error) {
          return {
            status: 'failed',
            message: `Terjadi kesalahan saat memperbarui data: ${error.message}`,
          };
        }
      } else {
        // Jika lock masih dalam waktu kurang dari 5 menit, tidak bisa edit
        return {
          status: 'failed',
          message: `Data pada table ${tableName} dengan ID ${tableId} sudah terkunci oleh ${existingLock.editing_by}. Tidak dapat diedit.`,
        };
      }
    }

    // Jika tidak ada lock, lakukan insert baru
    try {
      await trx('locks').insert({
        table: tableName,
        tableid: tableId,
        editing_by: editingBy,
        editing_at: datenow, // Waktu saat ini
        info: `Data pada table ${tableName} dengan ID ${tableId} sedang diedit.`,
        modifiedby: editingBy, // Menyimpan siapa yang memodifikasi
        created_at: datenow, // Waktu saat entri dibuat
        updated_at: datenow, // Waktu saat entri diperbarui
      });

      return {
        status: 'success',
        message: `Data pada table ${tableName} dengan ID ${tableId} berhasil dikunci untuk edit.`,
      };
    } catch (error) {
      return {
        status: 'failed',
        message: `Terjadi kesalahan saat menyimpan data: ${error.message}`,
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
