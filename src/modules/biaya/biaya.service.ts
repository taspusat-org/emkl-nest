import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateBiayaDto } from './dto/create-biaya.dto';
import { UpdateBiayaDto } from './dto/update-biaya.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RunningNumberService } from '../running-number/running-number.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook, Column } from 'exceljs';

@Injectable()
export class BiayaService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}
  private readonly tableName = 'biaya';
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
        coahut,
        jenisorderan_id,
        statusaktif,
        modifiedby,
        created_at,
        updated_at,
        info,
      } = CreateBankDto;
      const insertData = {
        nama: nama ? nama.toUpperCase() : null,
        keterangan: keterangan ? keterangan.toUpperCase() : null,
        coa: coa,
        coahut: coahut,
        jenisorderan_id: jenisorderan_id,
        statusaktif: statusaktif,
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
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );
      let itemIndex = data.findIndex((item) => item.id === newItem.id);
      if (itemIndex === -1) {
        itemIndex = 0;
      }
      // Optionally, you can find the page number or other info if needed
      const pageNumber = pagination?.currentPage;
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(newItem),
      );
      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD BIAYA',
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
          'b.coahut',
          'b.jenisorderan_id',
          'b.statusaktif',
          'b.info',
          'b.modifiedby',
          trx.raw("FORMAT(b.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(b.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'p.memo',
          'p.text',
          'p2.keterangancoa as coa_text',
          'p3.keterangancoa as coahut_text',
          'p4.nama as jenisorderan_text',
        ])
        .leftJoin(
          trx.raw('parameter as p WITH (READUNCOMMITTED)'),
          'b.statusaktif',
          'p.id',
        )
        .leftJoin(
          trx.raw('akunpusat as p2 WITH (READUNCOMMITTED)'),
          'b.coa',
          'p2.coa',
        )
        .leftJoin(
          trx.raw('akunpusat as p3 WITH (READUNCOMMITTED)'),
          'b.coahut',
          'p3.coa',
        )
        .leftJoin(
          trx.raw('jenisorderan as p4 WITH (READUNCOMMITTED)'),
          'b.jenisorderan_id',
          'p4.id',
        );

      if (search) {
        const val = String(search).replace(/\[/g, '[[]');

        query.where((builder) =>
          builder
            .orWhere('b.nama', 'like', `%${val}%`)
            .orWhere('b.keterangan', 'like', `%${val}%`)
            .orWhere('p2.keterangancoa', 'like', `%${val}%`) // coa_text
            .orWhere('p3.keterangancoa', 'like', `%${val}%`) // coahut_text
            .orWhere('p4.nama', 'like', `%${val}%`) // jenisorderan_text
            .orWhere('p.memo', 'like', `%${val}%`)
            .orWhere('p.text', 'like', `%${val}%`),
        );
      }

      // filter berdasarkan key yang valid
      if (filters) {
        for (const [key, rawValue] of Object.entries(filters)) {
          if (key === 'tglDari' || key === 'tglSampai') continue;
          if (!rawValue) continue;

          const val = String(rawValue).replace(/\[/g, '[[]');

          if (key === 'created_at' || key === 'updated_at') {
            query.andWhereRaw("FORMAT(b.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
              key,
              `%${val}%`,
            ]);
          } else if (key === 'statusaktif') {
            query.andWhere('b.statusaktif', 'like', `%${val}%`);
          } else if (key === 'memo') {
            query.andWhere('p.memo', 'like', `%${val}%`);
          } else if (key === 'text') {
            query.andWhere('p.text', 'like', `%${val}%`);
          } else if (key === 'coa_text') {
            query.andWhere('p2.keterangancoa', 'like', `%${val}%`);
          } else if (key === 'coahut_text') {
            query.andWhere('p3.keterangancoa', 'like', `%${val}%`);
          } else if (key === 'jenisorderan_text') {
            query.andWhere('p4.nama', 'like', `%${val}%`);
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
        throw new Error('Biaya not found');
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        coa_text,
        coahut_text,
        jenisorderan_text,
        text,
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
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );

      // Cari index item yang baru saja diupdate
      const itemIndex = filteredData.findIndex(
        (item) => Number(item.id) === id,
      );
      if (itemIndex === -1) {
        throw new Error('Updated item not found in all items');
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
          postingdari: 'EDIT BIAYA',
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
      console.error('Error updating Biaya:', error);
      throw new Error('Failed to update Biaya');
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
          postingdari: 'DELETE BIAYA',
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
    worksheet.getCell('A2').value = 'LAPORAN BIAYA';
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
      'COA HUTANG',
      'JENIS ORDERAN',
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
      worksheet.getCell(currentRow, 4).value = row.coa_text;
      worksheet.getCell(currentRow, 5).value = row.coahut_text;
      worksheet.getCell(currentRow, 6).value = row.jenisorderan_text;
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
