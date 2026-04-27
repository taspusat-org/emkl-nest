import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook, Column } from 'exceljs';

@Injectable()
export class BankService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}
  private readonly tableName = 'bank';
  async create(CreateBankDto: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        nama,
        keterangan,
        coa,
        coagantung,
        statusbank,
        statusaktif,
        statusdefault,
        formatpenerimaan,
        formatpengeluaran,
        formatpenerimaangantung,
        formatpengeluarangantung,
        formatpencairan,
        formatrekappenerimaan,
        formatrekappengeluaran,
        modifiedby,
        id: skipId,
        created_at,
        updated_at,
        info,
      } = CreateBankDto;
      const insertData = {
        nama: nama ? nama.toUpperCase() : null,
        keterangan: keterangan ? keterangan.toUpperCase() : null,
        coa: coa,
        coagantung: coagantung,
        statusbank: statusbank,
        statusaktif: statusaktif,
        statusdefault: statusdefault,
        formatpenerimaan: formatpenerimaan,
        formatpengeluaran: formatpengeluaran,
        formatpenerimaangantung: formatpenerimaangantung,
        formatpengeluarangantung: formatpengeluarangantung,
        formatpencairan: formatpencairan,
        formatrekappenerimaan: formatrekappenerimaan,
        formatrekappengeluaran: formatrekappengeluaran,
        modifiedby: modifiedby,
        created_at: created_at || this.utilsService.getTime(),
        updated_at: updated_at || this.utilsService.getTime(),
      };
      // Insert the new item
      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');
      const newItem = insertedItems[0]; // Get the inserted item
      const { data, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit: 0 },
          sort: { sortBy, sortDirection },
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );
      let itemIndex = data.findIndex(
        (item) => Number(item.id) === Number(newItem.id),
      );
      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const pageNumber = Math.floor(itemIndex / limit) + 1;
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(data),
      );
      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD BANK',
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
      throw new Error(`Error creating biaya: ${error.message}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      // default pagination
      let { page, limit } = pagination ?? {};

      page = page ?? 1;
      limit = limit ?? 0;

      // lookup mode: jika total > 500, kirim json saja
      if (isLookUp) {
        const countResult = await trx(this.tableName)
          .count('id as total')
          .first();
        const totalCount = Number(countResult?.total) || 0;
        if (totalCount > 500) {
          return { data: { type: 'json' } };
        }
        limit = 0;
      }

      // build query
      const query = trx
        .from(trx.raw(`${this.tableName} as b WITH (READUNCOMMITTED)`))
        .select([
          'b.id',
          'b.nama',
          'b.keterangan',
          'b.coa',
          'b.coagantung',
          'a.keterangancoa as keterangancoa',
          'a2.keterangancoa as keterangancoagantung',
          'b.statusbank',
          'b.statusaktif',
          'b.statusdefault',
          'b.formatpenerimaan',
          'b.formatpengeluaran',
          'b.formatpenerimaangantung',
          'b.formatpengeluarangantung',
          'b.formatpencairan',
          'b.formatrekappenerimaan',
          'b.formatrekappengeluaran',
          'b.info',
          'b.modifiedby',
          trx.raw("FORMAT(b.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(b.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'p.memo',
          'p.text',
          'p2.text as textbank',
          'p2.memo as statusbank_memo',
          'p3.text as textdefault',
          'p3.memo as statusdefault_memo',
          'p4.text as formatpenerimaantext',
          'p5.text as formatpengeluarantext',
          'p6.text as formatpenerimaangantungtext',
          'p7.text as formatpengeluarangantungtext',
          'p8.text as formatpencairantext',
          'p9.text as formatrekappenerimaantext',
          'p10.text as formatrekappengeluarantext',
        ])
        .leftJoin(
          trx.raw('akunpusat as a WITH (READUNCOMMITTED)'),
          'b.coa',
          'a.coa',
        )
        .leftJoin(
          trx.raw('akunpusat as a2 WITH (READUNCOMMITTED)'),
          'b.coagantung',
          'a2.coa',
        )
        .leftJoin(
          trx.raw('parameter as p WITH (READUNCOMMITTED)'),
          'b.statusaktif',
          'p.id',
        )
        .leftJoin(
          trx.raw('parameter as p2 WITH (READUNCOMMITTED)'),
          'b.statusbank',
          'p2.id',
        )
        .leftJoin(
          trx.raw('parameter as p3 WITH (READUNCOMMITTED)'),
          'b.statusdefault',
          'p3.id',
        )
        .leftJoin(
          trx.raw('parameter as p4 WITH (READUNCOMMITTED)'),
          'b.formatpenerimaan',
          'p4.id',
        )
        .leftJoin(
          trx.raw('parameter as p5 WITH (READUNCOMMITTED)'),
          'b.formatpengeluaran',
          'p5.id',
        )
        .leftJoin(
          trx.raw('parameter as p6 WITH (READUNCOMMITTED)'),
          'b.formatpenerimaangantung',
          'p6.id',
        )
        .leftJoin(
          trx.raw('parameter as p7 WITH (READUNCOMMITTED)'),
          'b.formatpengeluarangantung',
          'p7.id',
        )
        .leftJoin(
          trx.raw('parameter as p8 WITH (READUNCOMMITTED)'),
          'b.formatpencairan',
          'p8.id',
        )
        .leftJoin(
          trx.raw('parameter as p9 WITH (READUNCOMMITTED)'),
          'b.formatrekappenerimaan',
          'p9.id',
        )
        .leftJoin(
          trx.raw('parameter as p10 WITH (READUNCOMMITTED)'),
          'b.formatrekappengeluaran',
          'p10.id',
        );

      const excludeSearchKeys = [
        'statusbank',
        'statusaktif',
        'statusdefault',
        'formatpenerimaan',
        'formatpengeluaran',
        'formatpenerimaangantung',
        'formatpengeluarangantung',
        'formatpencairan',
        'formatrekappenerimaan',
        'formatrekappengeluaran',
        'coa',
        'coagantung',
      ];

      const searchFields = Object.keys(filters || {}).filter(
        (k) => !excludeSearchKeys.includes(k),
      );

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');

        query.where((qb) => {
          searchFields.forEach((field) => {
            if (['created_at', 'updated_at'].includes(field)) {
              qb.orWhereRaw("FORMAT(b.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
                field,
                `%${sanitizedValue}%`,
              ]);
            } else if (field === 'keterangancoa') {
              qb.orWhere('a.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (field === 'keterangancoagantung') {
              qb.orWhere('a2.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (field === 'memo' || field === 'text') {
              qb.orWhere(`p.${field}`, 'like', `%${sanitizedValue}%`);
            } else if (field === 'textbank' || field === 'statusbank_memo') {
              const col = field === 'textbank' ? 'text' : 'memo';
              qb.orWhere(`p2.${col}`, 'like', `%${sanitizedValue}%`);
            } else if (
              field === 'textdefault' ||
              field === 'statusdefault_memo'
            ) {
              const col = field === 'textdefault' ? 'text' : 'memo';
              qb.orWhere(`p3.${col}`, 'like', `%${sanitizedValue}%`);
            } else if (field === 'formatpenerimaantext') {
              qb.orWhere('p4.text', 'like', `%${sanitizedValue}%`);
            } else if (field === 'formatpengeluarantext') {
              qb.orWhere('p5.text', 'like', `%${sanitizedValue}%`);
            } else if (field === 'formatpenerimaangantungtext') {
              qb.orWhere('p6.text', 'like', `%${sanitizedValue}%`);
            } else if (field === 'formatpengeluarangantungtext') {
              qb.orWhere('p7.text', 'like', `%${sanitizedValue}%`);
            } else if (field === 'formatpencairantext') {
              qb.orWhere('p8.text', 'like', `%${sanitizedValue}%`);
            } else if (field === 'formatrekappenerimaantext') {
              qb.orWhere('p9.text', 'like', `%${sanitizedValue}%`);
            } else if (field === 'formatrekappengeluarantext') {
              qb.orWhere('p10.text', 'like', `%${sanitizedValue}%`);
            } else {
              qb.orWhere(`b.${field}`, 'like', `%${sanitizedValue}%`);
            }
          });
        });
      }

      // filter berdasarkan key yang valid
      if (filters) {
        for (const [key, rawValue] of Object.entries(filters)) {
          if (key === 'tglDari' || key === 'tglSampai') {
            continue; // Lewati filter jika key adalah 'tglDari' atau 'tglSampai'
          }
          if (!rawValue) continue;
          const val = String(rawValue).replace(/\[/g, '[[]');

          if (key === 'created_at' || key === 'updated_at') {
            query.andWhereRaw("FORMAT(b.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
              key,
              `%${val}%`,
            ]);
          } else if (key === 'text') {
            query.andWhere(`b.statusaktif`, 'like', `%${val}%`);
          } else if (key === 'memo') {
            query.andWhere(`p.memo`, 'like', `%${val}%`);
          } else if (key === 'textbank') {
            query.andWhere(`b.statusbank`, 'like', `%${val}%`);
          } else if (key === 'textdefault') {
            query.andWhere(`b.statusdefault`, 'like', `%${val}%`);
          } else if (key === 'formatpenerimaantext') {
            query.andWhere(`p4.text`, 'like', `%${val}%`);
          } else if (key === 'formatpengeluarantext') {
            query.andWhere(`p5.text`, 'like', `%${val}%`);
          } else if (key === 'formatpenerimaangantungtext') {
            query.andWhere(`p6.text`, 'like', `%${val}%`);
          } else if (key === 'formatpengeluarangantungtext') {
            query.andWhere(`p7.text`, 'like', `%${val}%`);
          } else if (key === 'formatpencairantext') {
            query.andWhere(`p8.text`, 'like', `%${val}%`);
          } else if (key === 'formatrekappenerimaantext') {
            query.andWhere(`p9.text`, 'like', `%${val}%`);
          } else if (key === 'formatrekappengeluarantext') {
            query.andWhere(`p10.text`, 'like', `%${val}%`);
          } else if (key === 'keterangancoa') {
            query.andWhere(`a.keterangancoa`, 'like', `%${val}%`);
          } else if (key === 'keterangancoagantung') {
            query.andWhere(`a2.keterangancoa`, 'like', `%${val}%`);
          } else {
            query.andWhere(`b.${key}`, 'like', `%${val}%`);
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
      console.error('Error fetching bank data:', error);
      throw new Error('Failed to fetch bank data');
    }
  }

  async update(id: number, data: any, trx: any) {
    try {
      const existingData = await trx(this.tableName).where('id', id).first();

      if (!existingData) {
        throw new Error('Bank not found');
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        text,
        textbank,
        textdefault,
        formatpenerimaantext,
        formatpengeluarantext,
        formatpenerimaangantungtext,
        formatpengeluarangantungtext,
        formatpencairantext,
        formatrekappenerimaantext,
        formatrekappengeluarantext,
        keterangancoa,
        id: skipId,
        keterangancoagantung,
        ...insertData
      } = data;

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });
      const hasChanges = this.utilsService.hasChanges(insertData, existingData);

      if (hasChanges) {
        insertData.updated_at = this.utilsService.getTime();
        await trx(this.tableName).where('id', id).update(insertData);
      }

      const { data: filteredData, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit: 0 },
          sort: { sortBy, sortDirection },
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );

      // Cari index item yang baru saja diupdate
      let itemIndex = filteredData.findIndex(
        (item) => Number(item.id) === Number(id),
      );
      if (itemIndex === -1) {
        itemIndex = 0;
      }
      const itemsPerPage = limit || 10; // Default 10 items per page, atau yang dikirimkan dari frontend
      const pageNumber = Math.floor(itemIndex / itemsPerPage) + 1;

      const endIndex = pageNumber * itemsPerPage;
      const limitedItems = filteredData.slice(0, endIndex);
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'EDIT BANK',
          idtrans: id,
          nobuktitrans: id,
          aksi: 'EDIT',
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
      console.error('Error updating Bank:', error);
      throw new Error('Failed to update Bank');
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

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE BANK',
          idtrans: deletedData.id,
          nobuktitrans: deletedData.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedData),
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
  async exportToExcel(data: any[]) {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Data Export');

    worksheet.mergeCells('A1:G1');
    worksheet.mergeCells('A2:G2');
    worksheet.mergeCells('A3:G3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN BANK';
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

    const headers = [
      'NO.',
      'NAMA',
      'KETERANGAN',
      'COA',
      'COA GANTUNG',
      'STATUS BANK',
      'STATUS AKTIF',
    ];

    headers.forEach((header, index) => {
      const cell = worksheet.getCell(5, index + 1);
      cell.value = header;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF00' },
      };
      cell.font = { bold: true, name: 'Tahoma', size: 10 };
      cell.alignment = {
        horizontal: index === 0 ? 'right' : 'center', // header NO. -> kanan
        vertical: 'middle',
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    worksheet.getRow(5).height = 18;

    data.forEach((row, rowIndex) => {
      const currentRow = rowIndex + 6;

      worksheet.getCell(currentRow, 1).value = rowIndex + 1;
      worksheet.getCell(currentRow, 2).value = row.nama;
      worksheet.getCell(currentRow, 3).value = row.keterangan;
      worksheet.getCell(currentRow, 4).value = row.keterangancoa;
      worksheet.getCell(currentRow, 5).value = row.keterangancoagantung;
      worksheet.getCell(currentRow, 6).value = row.textbank;
      worksheet.getCell(currentRow, 7).value = row.text;

      // Styling untuk setiap cell
      for (let col = 1; col <= headers.length; col++) {
        const cell = worksheet.getCell(currentRow, col);
        cell.font = { name: 'Tahoma', size: 10 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = {
          horizontal: col === 1 ? 'right' : 'left', // NO. rata kanan
          vertical: 'middle',
        };
      }
    });

    worksheet.getColumn(1).width = 6; // NO
    worksheet.getColumn(2).width = 20; // NAMA
    worksheet.getColumn(3).width = 30; // KETERANGAN
    worksheet.getColumn(4).width = 25; // KETERANGAN COA
    worksheet.getColumn(5).width = 25; // KETERANGAN COA GANTUNG
    worksheet.getColumn(6).width = 20; // STATUS BANK
    worksheet.getColumn(7).width = 15; // STATUS AKTIF

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_bank_${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath;
  }
}
