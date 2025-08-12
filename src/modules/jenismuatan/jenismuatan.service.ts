import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateJenisMuatanDto } from './dto/create-jenismuatan.dto';
import { UpdateJenisMuatanDto } from './dto/update-jenismuatan.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { dbMssql } from 'src/common/utils/db';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook } from 'exceljs';

@Injectable()
export class JenisMuatanService {
  private readonly tableName = 'jenismuatan';
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}
  async create(createJenisMuatanDto: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        statusaktif_text,
        ...insertData
      } = createJenisMuatanDto;
      insertData.updated_at = this.utilsService.getTime();
      insertData.created_at = this.utilsService.getTime();

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });

      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      
     
      const newItem = insertedItems[0];


      const { data, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false,
        },
        trx,
      );
      let itemIndex = data.findIndex((item) => item.id === newItem.id);
      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const pageNumber = pagination?.currentPage;

      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(data),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD JENIS MUATAN',
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
      throw new Error(`Error creating jenismuatan: ${error.message}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      let { page, limit } = pagination;
      page = page ?? 1;
      limit = limit ?? 0;

      if (isLookUp) {
        const jenismuatanCountResult = await trx(this.tableName)
          .count('id as total')
          .first();

        const jenismuatanCount = jenismuatanCountResult?.total || 0;
        if (Number(jenismuatanCount) > 500) {
          return { data: { type: 'json' } };
        } else {
          limit = 0;
        }
      }

      const query = trx(`${this.tableName} as jenismuatan`)
        .select([
          'jenismuatan.id as id',
          'jenismuatan.nama',
          'jenismuatan.keterangan',
          'jenismuatan.statusaktif',
          'jenismuatan.modifiedby',
          trx.raw(
            "FORMAT(jenismuatan.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at",
          ),
          trx.raw(
            "FORMAT(jenismuatan.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at",
          ),
          'par.memo',
          'par.text',
        ])
        .leftJoin('parameter as par', 'jenismuatan.statusaktif', 'par.id');

      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('jenismuatan.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('jenismuatan.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('par.memo', 'like', `%${sanitizedValue}%`)
            .orWhere('par.text', 'like', `%${sanitizedValue}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'created_at' || key === 'updated_at') {
              query.andWhereRaw(
                "FORMAT(jenismuatan.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?",
                [key, `%${sanitizedValue}%`],
              );
            } else if (key === 'text' || key === 'memo') {
              query.andWhere(`par.${key}`, '=', sanitizedValue);
            } else {
              query.andWhere(`jenismuatan.${key}`, 'like', `%${sanitizedValue}%`);
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

  async findAllByIds(ids: { id: number }[]) {
    try {
      const idList = ids.map((item) => item.id);
      const tempData = `##temp_${Math.random().toString(36).substring(2, 15)}`;

      const createTempTableQuery = `
        CREATE TABLE ${tempData} (
          id INT
        );
      `;
      await dbMssql.raw(createTempTableQuery);

      const insertTempTableQuery = `
        INSERT INTO ${tempData} (id)
        VALUES ${idList.map((id) => `(${id})`).join(', ')};
      `;
      await dbMssql.raw(insertTempTableQuery);

      const query = dbMssql(`${this.tableName} as jenismuatan`)
        .select([
          'jenismuatan.id as id',
          'jenismuatan.nama',
          'jenismuatan.keterangan',
          'jenismuatan.statusaktif',
          'jenismuatan.modifiedby',
          dbMssql.raw(
            "FORMAT(jenismuatan.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at",
          ),
          dbMssql.raw(
            "FORMAT(jenismuatan.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at",
          ),
          'par.memo',
          'par.text',
        ])
        .leftJoin('parameter as par', 'jenismuatan.statusaktif', 'par.id')
        .join(dbMssql.raw(`${tempData} as temp`), 'jenismuatan.id', 'temp.id')

        .orderBy('jenismuatan.nama', 'ASC');

      const data = await query;

      const dropTempTableQuery = `DROP TABLE ${tempData};`;
      await dbMssql.raw(dropTempTableQuery);

      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw new Error('Failed to fetch data');
    }
  }

  async getById(id: number, trx: any) {
    try {
      const result = await trx(this.tableName).where('id', id).first();

      if (!result) {
        throw new Error('Data not found');
      }

      return result;
    } catch (error) {
      console.error('Error fetching data by id:', error);
      throw new Error('Failed to fetch data by id');
    }
  }

  async update(id: number, data: any, trx: any) {
    try {
      const existingData = await trx(this.tableName).where('id', id).first();

      if (!existingData) {
        throw new Error('Jenis Muatan not found');
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        statusaktif_text,
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

      // Ambil data hingga halaman yang mencakup item yang baru diperbarui
      const endIndex = pageNumber * itemsPerPage;
      const limitedItems = filteredData.slice(0, endIndex);
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'EDIT JENIS MUATAN',
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
      console.error('Error updating jenis muatan:', error);
      throw new Error('Failed to update jenis muatan');
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
          postingdari: 'DELETE JENIS MUATAN',
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
    worksheet.getCell('A2').value = 'LAPORAN JENIS MUATAN';
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

    const headers = ['NO.', 'NAMA', 'KETERANGAN', 'STATUS AKTIF'];
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
      worksheet.getCell(currentRow, 4).value = row.text;

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
    worksheet.getColumn(2).width = 30;
    worksheet.getColumn(3).width = 30;
    worksheet.getColumn(4).width = 20;

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_menu${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath;
  }
}
