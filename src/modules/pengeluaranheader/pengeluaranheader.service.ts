import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePengeluaranheaderDto } from './dto/create-pengeluaranheader.dto';
import { UpdatePengeluaranheaderDto } from './dto/update-pengeluaranheader.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import { PengeluarandetailService } from '../pengeluarandetail/pengeluarandetail.service';
import { GlobalService } from '../global/global.service';
import { LocksService } from '../locks/locks.service';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook, Column } from 'exceljs';

@Injectable()
export class PengeluaranheaderService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
    private readonly pengeluarandetailService: PengeluarandetailService,
    private readonly locksService: LocksService,
    private readonly globalService: GlobalService,
  ) {}
  private readonly tableName = 'pengeluaranheader';
  async create(data: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        relasi_text,
        bank_text,
        alatbayar_text,
        daftarbank_text,
        coakredit_text,
        details,
        ...insertData
      } = data;

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });
      insertData.tglbukti = formatDateToSQL(String(insertData?.tglbukti)); // Fungsi untuk format
      const parameter = await trx('parameter')
        .select('*')
        .where('grp', 'PENGELUARAN')
        .first();

      const getStatusBank = await trx('bank')
        .select('formatpengeluaran')
        .where('id', `${insertData.bank_id}`)
        .first();

      const nomorBukti = await this.runningNumberService.generateRunningNumber(
        trx,
        parameter.grp,
        parameter.subgrp,
        this.tableName,
        insertData.tglbukti,
      );
      insertData.nobukti = nomorBukti;
      insertData.statusformat = getStatusBank
        ? getStatusBank.formatpengeluaran
        : null;

      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      if (details.length > 0) {
        const detailsWithNobukti = details.map(
          ({ coadebet_text, ...detail }: any) => ({
            ...detail,
            nobukti: nomorBukti,
            modifiedby: insertData.modifiedby,
          }),
        );

        await this.pengeluarandetailService.create(
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
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );

      // Cari index item baru di hasil yang sudah difilter
      let itemIndex = filteredItems.findIndex(
        (item) => Number(item.id) === Number(newItem.id),
      );

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
          postingdari: `ADD PENGELUARAN HEADER`,
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
      throw new Error(`Error: ${error.message}`);
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

      const query = trx
        .from(trx.raw(`${this.tableName} as u WITH (READUNCOMMITTED)`))
        .select([
          'u.id as id',
          'u.nobukti',
          trx.raw("FORMAT(u.tglbukti, 'dd-MM-yyyy') as tglbukti"),
          'u.relasi_id',
          'u.keterangan',
          'u.bank_id',
          'u.postingdari',
          'u.coakredit',
          'u.dibayarke',
          'u.alatbayar_id',
          'u.nowarkat',
          trx.raw("FORMAT(u.tgljatuhtempo, 'dd-MM-yyyy') as tgljatuhtempo"),
          'u.gantungorderan_nobukti',
          'u.daftarbank_id',
          'u.statusformat',
          'u.modifiedby',
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'r.nama as relasi_text',
          'b.nama as bank_text',
          'a.keterangancoa as coakredit_text',
          'c.nama as alatbayar_text',
          'd.nama as daftarbank_text',
        ])
        .leftJoin(
          trx.raw('relasi as r WITH (READUNCOMMITTED)'),
          'u.relasi_id',
          'r.id',
        )
        .leftJoin(
          trx.raw('bank as b WITH (READUNCOMMITTED)'),
          'u.bank_id',
          'b.id',
        )
        .leftJoin(
          trx.raw('akunpusat as a WITH (READUNCOMMITTED)'),
          'u.coakredit',
          'a.coa',
        )
        .leftJoin(
          trx.raw('alatbayar as c WITH (READUNCOMMITTED)'),
          'u.alatbayar_id',
          'c.id',
        )
        .leftJoin(
          trx.raw('daftarbank as d WITH (READUNCOMMITTED)'),
          'u.daftarbank_id',
          'd.id',
        );

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

          if (key === 'tglDari' || key === 'tglSampai') {
            continue;
          }

          if (value) {
            if (
              key === 'created_at' ||
              key === 'updated_at' ||
              key === 'editing_at' ||
              key === 'tglbukti' ||
              key === 'tgljatuhtempo'
            ) {
              query.andWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
                key,
                `%${sanitizedValue}%`,
              ]);
            } else if (key === 'relasi_text') {
              query.andWhere('r.nama', 'like', `%${sanitizedValue}%`);
            } else if (key === 'bank_text') {
              query.andWhere('b.nama', 'like', `%${sanitizedValue}%`);
            } else if (key === 'bank_id') {
              query.andWhere('u.bank_id', 'like', `%${sanitizedValue}%`);
            } else if (key === 'coakredit_text') {
              query.andWhere('a.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (key === 'alatbayar_text') {
              query.andWhere('c.nama', 'like', `%${sanitizedValue}%`);
            } else if (key === 'daftarbank_text') {
              query.andWhere('d.nama', 'like', `%${sanitizedValue}%`);
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

  async findOne(
    { search, filters, pagination, sort }: FindAllParams,
    id: string,
    trx: any,
  ) {
    try {
      let { page, limit } = pagination ?? {};

      page = page ?? 1;
      limit = limit ?? 0;

      const query = trx
        .from(trx.raw(`${this.tableName} as u WITH (READUNCOMMITTED)`))
        .select([
          'u.id as id',
          'u.nobukti',
          trx.raw("FORMAT(u.tglbukti, 'dd-MM-yyyy') as tglbukti"),
          'u.relasi_id',
          'u.keterangan',
          'u.bank_id',
          'u.postingdari',
          'u.coakredit',
          'u.dibayarke',
          'u.alatbayar_id',
          'u.nowarkat',
          trx.raw("FORMAT(u.tgljatuhtempo, 'dd-MM-yyyy') as tgljatuhtempo"),
          'u.gantungorderan_nobukti',
          'u.daftarbank_id',
          'u.statusformat',
          'u.modifiedby',
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'r.nama as relasi_text',
          'b.nama as bank_text',
          'a.keterangancoa as coakredit_text',
          'c.nama as alatbayar_text',
          'd.nama as daftarbank_text',
        ])
        .leftJoin(
          trx.raw('relasi as r WITH (READUNCOMMITTED)'),
          'u.relasi_id',
          'r.id',
        )
        .leftJoin(
          trx.raw('bank as b WITH (READUNCOMMITTED)'),
          'u.bank_id',
          'b.id',
        )
        .leftJoin(
          trx.raw('akunpusat as a WITH (READUNCOMMITTED)'),
          'u.coakredit',
          'a.coa',
        )
        .leftJoin(
          trx.raw('alatbayar as c WITH (READUNCOMMITTED)'),
          'u.alatbayar_id',
          'c.id',
        )
        .leftJoin(
          trx.raw('daftarbank as d WITH (READUNCOMMITTED)'),
          'u.daftarbank_id',
          'd.id',
        )
        .where('u.id', id);

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
              key === 'editing_at' ||
              key === 'tglbukti' ||
              key === 'tgljatuhtempo'
            ) {
              query.andWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
                key,
                `%${sanitizedValue}%`,
              ]);
            } else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      if (sort?.sortBy && sort?.sortDirection) {
        query.orderBy(sort.sortBy, sort.sortDirection);
      }

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
        relasi_text,
        bank_text,
        alatbayar_text,
        daftarbank_text,
        coakredit_text,
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

      // Check each detail, update or set id accordingly
      if (details.length > 0) {
        const cleanedDetails = details.map(
          ({ coadebet_text, ...rest }) => rest,
        );

        await this.pengeluarandetailService.create(cleanedDetails, id, trx);
      }

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
          postingdari: `ADD PENGELUARAN HEADER`,
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
        'pengeluarandetail',
        'pengeluaran_id',
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE PENGELUARAN DETAIL',
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
    worksheet.mergeCells('A1:D1'); // Ubah dari E1 ke D1 karena hanya 4 kolom
    worksheet.mergeCells('A2:D2'); // Ubah dari E2 ke D2 karena hanya 4 kolom
    worksheet.mergeCells('A3:D3'); // Ubah dari E3 ke D3 karena hanya 4 kolom

    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN PENGELUARAN';
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
      const detailRes = await this.pengeluarandetailService.findAll(h.id, trx);
      const details = detailRes.data ?? [];

      const headerInfo = [
        ['No Bukti', h.nobukti ?? ''],
        ['Tanggal', h.tglbukti ?? ''],
        ['Bank / Kas', h.bank_text ?? ''],
        ['Tanggal Kas', h.tgljatuhtempo ?? ''],
        ['Relasi', h.relasi_text ?? ''],
      ];

      // Merge kolom A dan B untuk seluruh area header info
      const headerStartRow = currentRow;
      const headerEndRow = currentRow + headerInfo.length - 1;

      headerInfo.forEach(([label, value]) => {
        worksheet.getCell(`A${currentRow}`).value = label;
        worksheet.getCell(`A${currentRow}`).font = {
          bold: true,
          name: 'Tahoma',
          size: 10,
        };
        worksheet.getCell(`C${currentRow}`).value = value;
        worksheet.getCell(`C${currentRow}`).font = {
          name: 'Tahoma',
          size: 10,
        };
        currentRow++;
      });

      for (let row = headerStartRow; row <= headerEndRow; row++) {
        worksheet.mergeCells(`A${row}:B${row}`);
      }

      currentRow++;

      if (details.length > 0) {
        const tableHeaders = ['NO.', 'NAMA PERKIRAAN', 'KETERANGAN', 'NOMINAL'];

        tableHeaders.forEach((header, index) => {
          const cell = worksheet.getCell(currentRow, index + 1);
          cell.value = header;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF00' },
          };
          cell.font = {
            bold: true,
            name: 'Tahoma',
            size: 10,
          };
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
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
            d.coadebet_text ?? '',
            d.keterangan ?? '',
            d.nominal ?? '',
          ];

          rowValues.forEach((value, colIndex) => {
            const cell = worksheet.getCell(currentRow, colIndex + 1);
            cell.value = value;
            cell.font = {
              name: 'Tahoma',
              size: 10,
            };

            if (colIndex === 3) {
              cell.alignment = {
                horizontal: 'right',
                vertical: 'middle',
              };
            } else if (colIndex === 0) {
              cell.alignment = {
                horizontal: 'center',
                vertical: 'middle',
              };
            } else {
              cell.alignment = {
                horizontal: 'left',
                vertical: 'middle',
              };
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

        currentRow++;
      }
    }

    worksheet.getColumn(1).width = 6;

    worksheet.getColumn(2).width = 35;

    worksheet.getColumn(3).width = 25;

    worksheet.getColumn(4).width = 15;

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_pengeluaran${Date.now()}.xlsx`,
    );

    await workbook.xlsx.writeFile(tempFilePath);
    return tempFilePath;
  }
}
