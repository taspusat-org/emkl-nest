import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePengeluaranemklheaderDto } from './dto/create-pengeluaranemklheader.dto';
import { UpdatePengeluaranemklheaderDto } from './dto/update-pengeluaranemklheader.dto';
import { GlobalService } from '../global/global.service';
import { LocksService } from '../locks/locks.service';
import { Column, Workbook } from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { RunningNumberService } from '../running-number/running-number.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RedisService } from 'src/common/redis/redis.service';
import { UtilsService } from 'src/utils/utils.service';
import { formatDateToSQL } from 'src/utils/utils.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { PengeluaranemkldetailService } from '../pengeluaranemkldetail/pengeluaranemkldetail.service';
@Injectable()
export class PengeluaranemklheaderService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
    private readonly locksService: LocksService,
    private readonly globalService: GlobalService,
    private readonly pengeluaranemkldetailService: PengeluaranemkldetailService,
  ) {}
  private readonly tableName = 'pengeluaranemklheader';
  async create(data: any, trx: any) {
    try {
      data.tglbukti = formatDateToSQL(String(data?.tglbukti));

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        details,
        ...insertData
      } = data;
      insertData.updated_at = this.utilsService.getTime();
      insertData.created_at = this.utilsService.getTime();
      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });

      // **HELPER FUNCTION: Parse currency string to number**
      const parseCurrency = (value: any): number => {
        if (value === null || value === undefined || value === '') {
          return 0;
        }
        if (typeof value === 'number') {
          return value;
        }
        if (typeof value === 'string') {
          const cleanValue = value.replace(/[^0-9.-]/g, '');
          const parsed = parseFloat(cleanValue);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      // **PROSES DETAILS DAN VALIDASI BALANCE**
      if (details && details.length > 0) {
        let totalDebet = 0;
        let totalKredit = 0;

        // Transform details: konversi nominaldebet/nominalkredit menjadi nominal
        const processedDetails = details.map((detail: any, index: number) => {
          // Parse nominal debet dan kredit dari string currency
          const nominalDebetValue = parseCurrency(detail.nominaldebet);
          const nominalKreditValue = parseCurrency(detail.nominalkredit);

          // Validasi: minimal salah satu harus ada nilainya
          if (nominalDebetValue === 0 && nominalKreditValue === 0) {
            throw new HttpException(
              {
                statusCode: HttpStatus.BAD_REQUEST,
                message: `Line ${index + 1}: Nominal Debet atau Kredit harus diisi`,
                error: 'Bad Request',
              },
              HttpStatus.BAD_REQUEST,
            );
          }

          // Validasi: tidak boleh kedua-duanya terisi
          if (nominalDebetValue > 0 && nominalKreditValue > 0) {
            throw new HttpException(
              {
                statusCode: HttpStatus.BAD_REQUEST,
                message: `Line ${index + 1}: Tidak boleh mengisi Debet dan Kredit bersamaan`,
                error: 'Bad Request',
              },
              HttpStatus.BAD_REQUEST,
            );
          }

          // Buat object baru tanpa nominaldebet dan nominalkredit
          const { nominaldebet, nominalkredit, ...cleanDetail } = detail;

          // Set nominal berdasarkan debet atau kredit
          if (nominalDebetValue > 0) {
            cleanDetail.nominal = nominalDebetValue; // Positif untuk debet
            totalDebet += nominalDebetValue;
          } else if (nominalKreditValue > 0) {
            cleanDetail.nominal = nominalKreditValue * -1; // Negatif untuk kredit
            totalKredit += nominalKreditValue;
          }

          return cleanDetail;
        });

        // **VALIDASI BALANCE: Total Debet harus sama dengan Total Kredit**
        const selisih = totalDebet - totalKredit;

        const tolerance = 0.01;

        if (Math.abs(selisih) > tolerance) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: `Jurnal tidak balance!`,
              error: 'Bad Request',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        // Update details dengan yang sudah diproses
        data.details = processedDetails;
      } else {
        // Jika tidak ada details
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Detail jurnal tidak boleh kosong',
            error: 'Bad Request',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!insertData.nobukti) {
        const memoExpr = 'TRY_CONVERT(nvarchar(max), memo)';
        const parameter = await trx('parameter')
          .select(
            'grp',
            'subgrp',
            trx.raw(`JSON_VALUE(${memoExpr}, '$.MEMO') AS memo_nama`),
          )
          .where('grp', 'NOMOR PENERIMAAN')
          .andWhere('subgrp', 'NOMOR PENERIMAAN JURNAL')
          .first();

        const nomorBukti =
          await this.runningNumberService.generateRunningNumber(
            trx,
            parameter.grp,
            parameter.subgrp,
            this.tableName,
            insertData.tglbukti,
          );

        insertData.nobukti = nomorBukti;
        insertData.postingdari = parameter.memo_nama;
      }

      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      if (data.details && data.details.length > 0) {
        const detailsWithNobukti = data.details.map((detail: any) => ({
          ...detail,
          nobukti: insertData.nobukti,
          modifiedby: insertData.modifiedby,
        }));
        await this.pengeluaranemkldetailService.create(
          detailsWithNobukti,
          insertedItems[0].id,
          trx,
        );
      }
      const newItem = insertedItems[0];

      const { data: filteredItems } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false,
        },
        trx,
      );

      let itemIndex = filteredItems.findIndex(
        (item) => Number(item.id) === Number(newItem.id),
      );

      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const pageNumber = Math.floor(itemIndex / limit) + 1;
      const endIndex = pageNumber * limit;

      const limitedItems = filteredItems.slice(0, endIndex);

      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: `ADD KAS GANTUNG HEADER`,
          idtrans: newItem.id,
          nobuktitrans: newItem.id,
          aksi: 'ADD',
          datajson: JSON.stringify(newItem),
          modifiedby: newItem.modifiedby,
        },
        trx,
      );

      return {
        newItem,
        pageNumber,
        itemIndex,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal server error',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      let { page, limit } = pagination ?? {};

      page = page ?? 1;
      limit = limit ?? 0;

      if (isLookUp) {
        const acoCountResult = await trx(this.tableName)
          .count('id as total')
          .first();

        const acoCount = acoCountResult?.total || 0;

        if (Number(acoCount) > 500) {
          return { data: { type: 'json' } };
        } else {
          limit = 0;
        }
      }

      const query = trx(`${this.tableName} as u`)
        .select([
          'u.id as id',
          'u.nobukti', // nobukti (nvarchar(100))
          trx.raw("FORMAT(u.tglbukti, 'dd-MM-yyyy') as tglbukti"),
          trx.raw("FORMAT(u.tgljatuhtempo, 'dd-MM-yyyy') as tgljatuhtempo"),
          'u.keterangan', // keterangan (nvarchar(max))
          'u.karyawan_id', // keterangan (nvarchar(max))
          'k.nama as karyawan_nama',
          'u.jenisposting', // keterangan (nvarchar(max))
          'u.bank_id', // keterangan (nvarchar(max))
          'b.nama as bank_nama',
          'u.nowarkat', // keterangan (nvarchar(max))
          'u.pengeluaran_nobukti', // keterangan (nvarchar(max))
          'u.hutang_nobukti', // keterangan (nvarchar(max))
          'u.statusformat', // bank_id (integer)
          'u.info', // info (nvarchar(max))
          'u.modifiedby', // modifiedby (varchar(200))
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"), // created_at (datetime)
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"), // updated_at (datetime)
        ])
        .leftJoin('karyawan as k', 'u.karyawan_id', 'k.id')
        .leftJoin('bank as b', 'u.bank_id', 'b.id');

      if (filters?.tglDari && filters?.tglSampai) {
        // Mengonversi tglDari dan tglSampai ke format yang diterima SQL (YYYY-MM-DD)
        const tglDariFormatted = formatDateToSQL(String(filters?.tglDari)); // Fungsi untuk format
        const tglSampaiFormatted = formatDateToSQL(String(filters?.tglSampai));

        // Menggunakan whereBetween dengan tanggal yang sudah diformat
        query.whereBetween('u.tglbukti', [
          tglDariFormatted,
          tglSampaiFormatted,
        ]);
      }
      const excludeSearchKeys = ['tglDari', 'tglSampai'];
      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }
      const searchFields = Object.keys(filters || {}).filter(
        (k) => !excludeSearchKeys.includes(k) && filters![k],
      );
      if (search) {
        const sanitized = String(search).replace(/\[/g, '[[]').trim();

        query.where((qb) => {
          searchFields.forEach((field) => {
            qb.orWhere(`u.${field}`, 'like', `%${sanitized}%`);
          });
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');

          // Menambahkan pengecualian untuk 'tglDari' dan 'tglSampai'
          if (key === 'tglDari' || key === 'tglSampai') {
            continue; // Lewati filter jika key adalah 'tglDari' atau 'tglSampai'
          }

          if (value) {
            if (
              key === 'created_at' ||
              key === 'updated_at' ||
              key === 'tglbukti' ||
              key === 'tgljatuhtempo'
            ) {
              query.andWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
                key,
                `%${sanitizedValue}%`,
              ]);
            } else if (key === 'karyawan_nama') {
              query.andWhere('k.nama', 'like', `%${sanitizedValue}%`);
            } else if (key === 'bank_nama') {
              query.andWhere('b.nama', 'like', `%${sanitizedValue}%`);
            } else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      const result = await trx(this.tableName).count('id as total').first();
      const total = result?.total as number;
      const totalPages = Math.ceil(total / limit);

      if (sort?.sortBy && sort?.sortDirection) {
        query.orderBy(sort.sortBy, sort.sortDirection);
      }

      const data = await query;

      const responseType = Number(total) > 500 ? 'json' : 'local';

      return {
        data: data,
        type: responseType,
        total,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      console.error('Error fetching data:', error);
      throw new Error('Failed to fetch data');
    }
  }

  async findOne(id: string, trx: any) {
    try {
      const query = trx(`${this.tableName} as u`)
        .select([
          'u.id as id',
          'u.nobukti', // nobukti (nvarchar(100))
          trx.raw("FORMAT(u.tglbukti, 'dd-MM-yyyy') as tglbukti"),
          trx.raw("FORMAT(u.tgljatuhtempo, 'dd-MM-yyyy') as tgljatuhtempo"),
          'u.keterangan', // keterangan (nvarchar(max))
          'u.karyawan_id', // keterangan (nvarchar(max))
          'k.nama as karyawan_nama',
          'u.jenisposting', // keterangan (nvarchar(max))
          'u.bank_id', // keterangan (nvarchar(max))
          'b.nama as bank_nama',
          'u.nowarkat', // keterangan (nvarchar(max))
          'u.pengeluaran_nobukti', // keterangan (nvarchar(max))
          'u.hutang_nobukti', // keterangan (nvarchar(max))
          'u.postingdari', // relasi_id (integer)
          'u.statusformat', // bank_id (integer)
          'u.info', // info (nvarchar(max))
          'u.modifiedby', // modifiedby (varchar(200))
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"), // created_at (datetime)
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"), // updated_at (datetime)
        ])
        .where('u.id', id);

      const data = await query;

      return {
        data: data,
      };
    } catch (error) {
      console.error('Error fetching data:', error);
      throw new Error('Failed to fetch data');
    }
  }

  async update(id: any, data: any, trx: any) {
    try {
      data.tglbukti = formatDateToSQL(String(data?.tglbukti)); // Fungsi untuk format

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        postingdari,
        statusformat,
        details,
        ...insertData
      } = data;

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });
      const existingData = await trx(this.tableName).where('id', id).first();
      const hasChanges = this.utilsService.hasChanges(insertData, existingData);

      if (hasChanges) {
        insertData.updated_at = this.utilsService.getTime();

        await trx(this.tableName).where('id', id).update(insertData);
      }
      // **HELPER FUNCTION: Parse currency string to number**
      const parseCurrency = (value: any): number => {
        if (value === null || value === undefined || value === '') {
          return 0;
        }
        if (typeof value === 'number') {
          return value;
        }
        if (typeof value === 'string') {
          const cleanValue = value.replace(/[^0-9.-]/g, '');
          const parsed = parseFloat(cleanValue);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      // **PROSES DETAILS DAN VALIDASI BALANCE**
      if (details && details.length > 0) {
        let totalDebet = 0;
        let totalKredit = 0;

        // Transform details: konversi nominaldebet/nominalkredit menjadi nominal
        const processedDetails = details.map((detail: any, index: number) => {
          // Parse nominal debet dan kredit dari string currency
          const nominalDebetValue = parseCurrency(detail.nominaldebet);
          const nominalKreditValue = parseCurrency(detail.nominalkredit);

          // Validasi: minimal salah satu harus ada nilainya
          if (nominalDebetValue === 0 && nominalKreditValue === 0) {
            throw new HttpException(
              {
                statusCode: HttpStatus.BAD_REQUEST,
                message: `Line ${index + 1}: Nominal Debet atau Kredit harus diisi`,
                error: 'Bad Request',
              },
              HttpStatus.BAD_REQUEST,
            );
          }

          // Validasi: tidak boleh kedua-duanya terisi
          if (nominalDebetValue > 0 && nominalKreditValue > 0) {
            throw new HttpException(
              {
                statusCode: HttpStatus.BAD_REQUEST,
                message: `Line ${index + 1}: Tidak boleh mengisi Debet dan Kredit bersamaan`,
                error: 'Bad Request',
              },
              HttpStatus.BAD_REQUEST,
            );
          }

          // Buat object baru tanpa nominaldebet dan nominalkredit
          const { nominaldebet, nominalkredit, ...cleanDetail } = detail;

          // Set nominal berdasarkan debet atau kredit
          if (nominalDebetValue > 0) {
            cleanDetail.nominal = nominalDebetValue; // Positif untuk debet
            totalDebet += nominalDebetValue;
          } else if (nominalKreditValue > 0) {
            cleanDetail.nominal = nominalKreditValue * -1; // Negatif untuk kredit
            totalKredit += nominalKreditValue;
          }

          return cleanDetail;
        });

        // **VALIDASI BALANCE: Total Debet harus sama dengan Total Kredit**
        const selisih = totalDebet - totalKredit;
        const tolerance = 0.01;

        if (Math.abs(selisih) > tolerance) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: `Jurnal tidak balance!`,
              error: 'Bad Request',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        // Update details dengan yang sudah diproses
        data.details = processedDetails;
      } else {
        // Jika tidak ada details
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Detail jurnal tidak boleh kosong',
            error: 'Bad Request',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check each detail, update or set id accordingly
      const detailsWithNobukti = data.details.map((detail: any) => ({
        ...detail,
        nobukti: existingData.nobukti, // Inject nobukti into each detail
        modifiedby: insertData.modifiedby,
      }));
      await this.pengeluaranemkldetailService.create(
        detailsWithNobukti,
        id,
        trx,
      );

      // If there are details, call the service to handle create or update

      const { data: filteredItems } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );

      // Cari index item baru di hasil yang sudah difilter
      let itemIndex = filteredItems.findIndex((item) => Number(item.id) === id);

      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const pageNumber = Math.floor(itemIndex / limit) + 1;
      const endIndex = pageNumber * limit;

      // Ambil data hingga halaman yang mencakup item baru
      const limitedItems = filteredItems.slice(0, endIndex);

      // Simpan ke Redis
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: `ADD KAS GANTUNG HEADER`,
          idtrans: id,
          nobuktitrans: id,
          aksi: 'ADD',
          datajson: JSON.stringify(data),
          modifiedby: data.modifiedby,
        },
        trx,
      );

      return {
        updatedItem: {
          id,
          ...data,
        },
        pageNumber,
        itemIndex,
      };
    } catch (error) {
      throw new Error(`Error: ${error.message}`);
    }
  }
  async delete(id: number, trx: any, modifiedby: string) {
    try {
      const deletedData = await this.utilsService.lockAndDestroy(
        id,
        this.tableName,
        'id',
        trx,
      );
      const deletedDataDetail = await this.utilsService.lockAndDestroy(
        id,
        'pengeluaranemkldetail',
        'jurnalumum_id',
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE KAS GANTUNG DETAIL',
          idtrans: deletedDataDetail.id,
          nobuktitrans: deletedDataDetail.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedDataDetail),
          modifiedby: modifiedby,
        },
        trx,
      );

      return { status: 200, message: 'Data deleted successfully', deletedData };
    } catch (error) {
      console.error('Error deleting data:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete data');
    }
  }
  async exportToExcel(data: any[], trx: any) {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Data Export');

    // Header laporan
    worksheet.mergeCells('A1:E1');
    worksheet.mergeCells('A2:E2');
    worksheet.mergeCells('A3:E3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN JURNAL UMUM';
    worksheet.getCell('A3').value = 'Data Export';
    ['A1', 'A2', 'A3'].forEach((cellKey, i) => {
      worksheet.getCell(cellKey).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      worksheet.getCell(cellKey).font = {
        name: 'Tahoma',
        size: i === 0 ? 14 : 10,
        bold: true,
      };
    });

    let currentRow = 5;

    for (const h of data) {
      const detailRes = await this.pengeluaranemkldetailService.findAll(
        {
          filters: {
            nobukti: h.nobukti,
          },
        },
        trx,
      );
      const details = detailRes.data ?? [];

      const headerInfo = [
        ['No Bukti', h.nobukti ?? ''],
        ['Tanggal Bukti', h.tglbukti ?? ''],
        ['Keterangan', h.keterangan ?? ''],
      ];

      headerInfo.forEach(([label, value]) => {
        worksheet.getCell(`A${currentRow}`).value = label;
        worksheet.getCell(`A${currentRow}`).font = {
          bold: true,
          name: 'Tahoma',
          size: 10,
        };
        worksheet.getCell(`B${currentRow}`).value = value;
        worksheet.getCell(`B${currentRow}`).font = { name: 'Tahoma', size: 10 };
        currentRow++;
      });

      currentRow++;

      if (details.length > 0) {
        const tableHeaders = [
          'NO.',
          'NO BUKTI',
          'KETERANGAN',
          'COA',
          'NOMINAL DEBET',
          'NOMINAL KREDIT',
        ];
        tableHeaders.forEach((header, index) => {
          const cell = worksheet.getCell(currentRow, index + 1);
          cell.value = header;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF00' },
          };
          cell.font = { bold: true, name: 'Tahoma', size: 10 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
        currentRow++;

        details.forEach((d: any, detailIndex: number) => {
          const rowValues = [
            detailIndex + 1,
            d.nobukti ?? '',
            d.keterangan ?? '',
            d.coa ?? '',
            d.nominaldebet ?? '',
            d.nominalkredit ?? '',
          ];
          rowValues.forEach((value, colIndex) => {
            const cell = worksheet.getCell(currentRow, colIndex + 1);
            cell.value = value;
            cell.font = { name: 'Tahoma', size: 10 };

            // kolom angka rata kanan, selain itu rata kiri
            if (colIndex === 3 || colIndex === 4 || colIndex === 5) {
              // kolom nominal
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else if (colIndex === 0) {
              // kolom nomor
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }

            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          });
          currentRow++;
        });

        // Tambahkan total nominal
        const totalNominal = details.reduce((sum: number, d: any) => {
          return sum + (parseFloat(d.nominal) || 0);
        }, 0);

        // Row total dengan border atas tebal
        const totalRow = currentRow;
        worksheet.getCell(`A${totalRow}`).value = 'TOTAL';
        worksheet.getCell(`A${totalRow}`).font = {
          bold: true,
          name: 'Tahoma',
          size: 10,
        };
        worksheet.getCell(`A${totalRow}`).alignment = {
          horizontal: 'left',
          vertical: 'middle',
        };
        worksheet.getCell(`A${totalRow}`).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        worksheet.mergeCells(`A${totalRow}:C${totalRow}`);

        worksheet.getCell(`D${totalRow}`).value = totalNominal;
        worksheet.getCell(`D${totalRow}`).font = {
          bold: true,
          name: 'Tahoma',
          size: 10,
        };
        worksheet.getCell(`D${totalRow}`).alignment = {
          horizontal: 'right',
          vertical: 'middle',
        };
        worksheet.getCell(`D${totalRow}`).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        currentRow++;
        currentRow++;
      }
    }

    worksheet.columns
      .filter((c): c is Column => !!c)
      .forEach((col) => {
        let maxLength = 0;
        col.eachCell({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, cellValue.length);
        });
        col.width = maxLength + 2;
      });

    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 30;

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempFilePath = path.resolve(
      tempDir,
      `laporan_jurnal_umum${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath;
  }
  async checkValidasi(aksi: string, value: any, editedby: any, trx: any) {
    try {
      if (aksi === 'EDIT') {
        const forceEdit = await this.locksService.forceEdit(
          this.tableName,
          value,
          editedby,
          trx,
        );

        return forceEdit;
      } else if (aksi === 'DELETE') {
        const validasi = await this.globalService.checkUsed(
          'pengembalianjurnalumumdetail',
          'jurnalumum_nobukti',
          value,
          trx,
        );

        return validasi;
      }
    } catch (error) {
      console.error('Error di checkValidasi:', error);
      throw new InternalServerErrorException('Failed to check validation');
    }
  }
}
