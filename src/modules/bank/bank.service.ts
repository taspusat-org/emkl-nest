import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RunningNumberService } from '../running-number/running-number.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { UtilsService } from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook } from 'exceljs';

@Injectable()
export class BankService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
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
      throw new Error(`Error creating container: ${error.message}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      // default pagination
      let { page, limit } = pagination;

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
      const query = trx(`${this.tableName} as b`)
        .select([
          'b.id',
          'b.nama',
          'b.keterangan',
          'b.coa',
          'b.coagantung',
          'a.keterangancoa as keterangancoa',
          'a2.keterangancoa as keterangancoagantung',
          'b.statusbank',
          'b.statusaktif ',
          'b.statusdefault ',
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
          'p3.text as textdefault',
          'p4.text as formatpenerimaantext',
          'p5.text as formatpengeluarantext',
          'p6.text as formatpenerimaangantungtext',
          'p7.text as formatpengeluarangantungtext',
          'p8.text as formatpencairantext',
          'p9.text as formatrekappenerimaantext',
          'p10.text as formatrekappengeluarantext',
        ])
        .leftJoin('akunpusat as a', 'b.coa', 'a.coa')
        .leftJoin('akunpusat as a2', 'b.coagantung', 'a2.coa')
        .leftJoin('parameter as p', 'b.statusaktif', 'p.id')
        .leftJoin('parameter as p2', 'b.statusbank', 'p2.id')
        .leftJoin('parameter as p3', 'b.statusdefault', 'p3.id')
        .leftJoin('parameter as p4', 'b.formatpenerimaan', 'p4.id')
        .leftJoin('parameter as p5', 'b.formatpengeluaran', 'p5.id')
        .leftJoin('parameter as p6', 'b.formatpenerimaangantung', 'p6.id')
        .leftJoin('parameter as p7', 'b.formatpengeluarangantung', 'p7.id')
        .leftJoin('parameter as p8', 'b.formatpencairan', 'p8.id')
        .leftJoin('parameter as p9', 'b.formatrekappenerimaan', 'p9.id')
        .leftJoin('parameter as p10', 'b.formatrekappengeluaran', 'p10.id');

      if (search) {
        const val = String(search).replace(/\[/g, '[[]');
        query.where((builder) =>
          builder
            .orWhere('b.nama', 'like', `%${val}%`)
            .orWhere('b.keterangan', 'like', `%${val}%`)
            .orWhere('a.keterangancoa', 'like', `%${val}%`)
            .orWhere('a2.keterangancoa', 'like', `%${val}%`)
            .orWhere('p.memo', 'like', `%${val}%`)
            .orWhere('p.text', 'like', `%${val}%`)
            .orWhere('p2.text', 'like', `%${val}%`)
            .orWhere('p3.text', 'like', `%${val}%`)
            .orWhere('p4.text', 'like', `%${val}%`)
            .orWhere('p5.text', 'like', `%${val}%`)
            .orWhere('p6.text', 'like', `%${val}%`)
            .orWhere('p7.text', 'like', `%${val}%`)
            .orWhere('p8.text', 'like', `%${val}%`)
            .orWhere('p9.text', 'like', `%${val}%`)
            .orWhere('p10.text', 'like', `%${val}%`),
        );
      }

      // filter berdasarkan key yang valid
      if (filters) {
        for (const [key, rawValue] of Object.entries(filters)) {
          if (!rawValue) continue;
          const val = String(rawValue).replace(/\[/g, '[[]');

          if (key === 'created_at' || key === 'updated_at') {
            query.andWhereRaw(
              `FORMAT(b.${key}, 'dd-MM-yyyy HH:mm:ss') like ?`,
              [`%${val}%`],
            );
          } else if (key === 'text') {
            query.andWhere(`b.statusaktif`, 'like', `%${val}%`);
          } else if (key === 'memo') {
            query.andWhere(`p.memo`, 'like', `%${val}%`);
          } else if (key === 'textbank') {
            query.andWhere(`b.statusbank`, 'like', `%${val}%`);
          } else if (key === 'textdefault') {
            query.andWhere(`b.statusdefault`, 'like', `%${val}%`);
          } else if (key === 'formatpenerimaantext') {
            query.andWhere(`b.formatpenerimaan`, 'like', `%${val}%`);
          } else if (key === 'formatpengeluarantext') {
            query.andWhere(`b.formatpengeluaran`, 'like', `%${val}%`);
          } else if (key === 'formatpenerimaangantungtext') {
            query.andWhere(`b.formatpenerimaangantung`, 'like', `%${val}%`);
          } else if (key === 'formatpengeluarangantungtext') {
            query.andWhere(`b.formatpengeluarangantung`, 'like', `%${val}%`);
          } else if (key === 'formatpencairantext') {
            query.andWhere(`b.formatpencairan`, 'like', `%${val}%`);
          } else if (key === 'formatrekappenerimaantext') {
            query.andWhere(`b.formatrekappenerimaan`, 'like', `%${val}%`);
          } else if (key === 'formatrekappengeluarantext') {
            query.andWhere(`b.formatrekappengeluaran`, 'like', `%${val}%`);
          } else if (key === 'keterangancoa') {
            query.andWhere(`b.coa`, 'like', `%${val}%`);
          } else if (key === 'keterangancoagantung') {
            query.andWhere(`b.coagantung`, 'like', `%${val}%`);
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
      console.log(data);
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

    worksheet.mergeCells('A1:I1');
    worksheet.mergeCells('A2:I2');
    worksheet.mergeCells('A3:I3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN BANK';
    worksheet.getCell('A3').value = 'Data Export';
    worksheet.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    worksheet.getCell('A2').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    worksheet.getCell('A3').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    worksheet.getCell('A1').font = { size: 14, bold: true };
    worksheet.getCell('A2').font = { bold: true };
    worksheet.getCell('A3').font = { bold: true };

    const headers = [
      'NO.',
      'NAMA',
      'KETERANGAN',
      'NAMA CABANG',
      'STATUS AKTIF',
      'MODIFIED BY',
      'CREATED AT',
      'UPDATED AT',
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
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    data.forEach((row, rowIndex) => {
      const currentRow = rowIndex + 6;

      worksheet.getCell(currentRow, 1).value = rowIndex + 1;
      worksheet.getCell(currentRow, 2).value = row.nama;
      worksheet.getCell(currentRow, 3).value = row.keterangan;
      worksheet.getCell(currentRow, 4).value = row.namacabang;
      worksheet.getCell(currentRow, 5).value = row.statusaktif;
      worksheet.getCell(currentRow, 6).value = row.modifiedby;
      worksheet.getCell(currentRow, 7).value = row.created_at;
      worksheet.getCell(currentRow, 8).value = row.updated_at;

      for (let col = 1; col <= headers.length; col++) {
        const cell = worksheet.getCell(currentRow, col);
        cell.font = { name: 'Tahoma', size: 10 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    });

    worksheet.getColumn(1).width = 10;
    worksheet.getColumn(2).width = 10;
    worksheet.getColumn(3).width = 30;
    worksheet.getColumn(4).width = 20;
    worksheet.getColumn(5).width = 30;
    worksheet.getColumn(6).width = 15;
    worksheet.getColumn(7).width = 20;
    worksheet.getColumn(8).width = 20;

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_bank${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath;
  }
}
