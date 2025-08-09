import { Injectable } from '@nestjs/common';
import { CreateGlobalDto } from './dto/create-global.dto';
import { UpdateGlobalDto } from './dto/update-global.dto';
import { dbMssql } from 'src/common/utils/db';

@Injectable()
export class GlobalService {
  async validationDelete(
    checks: { tableName: string; fieldName: string; fieldValue: any }[],
    trx: any, // Transaksi untuk database
  ): Promise<
    {
      tableName: string;
      fieldName: string;
      fieldValue: any;
      status: string;
      message: string;
    }[]
  > {
    const validationResults: {
      tableName: string;
      fieldName: string;
      fieldValue: any;
      status: string;
      message: string;
    }[] = []; // Menyimpan hasil validasi dengan tipe yang jelas

    // Iterasi untuk setiap item dalam checks
    for (const check of checks) {
      try {
        // Menjalankan pengecekan apakah ada record yang menggunakan field value
        const recordInUse = await trx(check.tableName)
          .where(check.fieldName, check.fieldValue)
          .first();

        // Jika record ditemukan, berarti tidak bisa dihapus
        if (recordInUse) {
          validationResults.push({
            tableName: check.tableName,
            fieldName: check.fieldName,
            fieldValue: check.fieldValue,
            status: 'failed',
            message: `Tidak diizinkan menghapus data ini, karena terdapat di ${check.tableName}.`,
          });
        } else {
          validationResults.push({
            tableName: check.tableName,
            fieldName: check.fieldName,
            fieldValue: check.fieldValue,
            status: 'success',
            message: `${check.fieldName} with value ${check.fieldValue} is free to delete.`,
          });
        }
      } catch (error) {
        // Jika ada error selama pengecekan (misalnya DB error), kita simpan hasil gagal
        validationResults.push({
          tableName: check.tableName,
          fieldName: check.fieldName,
          fieldValue: check.fieldValue,
          status: 'failed',
          message: `Error validating ${check.fieldName} with value ${check.fieldValue}: ${error.message}`,
        });
      }
    }

    // Mengembalikan hasil validasi untuk semua checks
    return validationResults;
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
