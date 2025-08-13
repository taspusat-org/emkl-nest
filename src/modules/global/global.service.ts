import { Injectable, UnauthorizedException } from '@nestjs/common';
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
