import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { UtilsService } from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import * as fs from 'fs';
import * as path from 'path';
import { Column, Workbook } from 'exceljs';
@Injectable()
export class AkunpusatService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
  ) {}
  private readonly tableName = 'akunpusat';
  async create(createAkunpusatDto: any, trx: any) {
    try {
      const {
        sortBy,
        id,
        sortDirection,
        filters,
        search,
        page,
        limit,
        parent_nama,
        statusaktif_nama,
        cabang_nama,
        type_nama,
        ...insertData
      } = createAkunpusatDto;
      insertData.updated_at = this.utilsService.getTime();
      insertData.created_at = this.utilsService.getTime();
      // Normalize the data (e.g., convert strings to uppercase)
      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });

      // Insert the new item
      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      const newItem = insertedItems[0]; // Get the inserted item

      // Now use findAll to get the updated list with pagination, sorting, and filters
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
      let itemIndex = data.findIndex((item) => item.id === newItem.id);
      if (itemIndex === -1) {
        itemIndex = 0;
      }

      // Optionally, you can find the page number or other info if needed
      const pageNumber = Math.floor(itemIndex / limit) + 1;

      // Optionally, you can log the event or store the new item in a cache if needed
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(data),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD AKUN PUSAT',
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
      throw new Error(`Error creating parameter: ${error.message}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      // Use default empty object if filters is undefined
      filters = filters ?? {};

      let { page, limit } = pagination ?? {};

      page = page ?? 1;
      limit = limit ?? 0;

      const excludedFields = [
        'created_at',
        'updated_at',
        'modifiedby',
        'type_nama',
        'statusaktif_nama',
        'cabang_nama',
        'parent_nama',
        'memo',
        'info',
        // Add more fields that you want to exclude here
      ];

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
          'u.type_id as type_id', // type_id (integer)
          'u.level as level', // level (integer)
          'u.coa as coa', // coa (nvarchar(100))
          'u.keterangancoa', // keterangancoa (nvarchar(max))
          'u.statusaktif as statusaktif', // statusaktif (group status aktif)
          'p.text as statusaktif_nama',
          'p.memo',
          'u.parent as parent',
          'u.cabang_id as cabang_id',
          'c.nama as cabang_nama',
          't.nama as type_nama',
          'u.info as info', // info (nvarchar(max))
          'u.modifiedby as modifiedby', // modifiedby (varchar(200))
          'u.created_at as created_at', // created_at (datetime)
          'u.updated_at as updated_at', // updated_at (datetime)
        ])
        .leftJoin('cabang as c', 'u.cabang_id', 'c.id')
        .leftJoin('typeakuntansi as t', 'u.type_id', 't.id')
        .leftJoin('parameter as p', 'u.statusaktif', 'p.id');

      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        // Tentukan dua field yang ingin dicari
        const searchableFields = ['coa', 'keterangancoa']; // Misalnya hanya 'name' dan 'email'

        query.where((builder) => {
          searchableFields.forEach((field) => {
            builder.orWhere(`u.${field}`, 'like', `%${sanitizedValue}%`);
          });
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          // Skip filtering on excluded fields
          if (excludedFields.includes(key)) continue;

          if (value) {
            if (key === 'created_at' || key === 'updated_at') {
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
  async update(data: any, trx: any) {
    try {
      const existingData = await trx(this.tableName)
        .where('id', data.id)
        .first();

      if (!existingData) {
        throw new Error('Container not found');
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        id,
        page,
        limit,
        statusaktif_nama,
        cabang_nama,
        type_nama,
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
          postingdari: 'EDIT CONTAINER',
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
      console.error('Error updating container:', error);
      throw new Error('Failed to update container');
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
          postingdari: 'DELETE CONTAINER',
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
    worksheet.mergeCells('A1:H1');
    worksheet.mergeCells('A2:H2');
    worksheet.mergeCells('A3:H3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN AKUN PUSAT';
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

    // Mendefinisikan header kolom
    const headers = [
      'NO.',
      'TYPE AKUNTANSI',
      'COA',
      'PARENT',
      'LEVEL',
      'KETERANGAN COA',
      'CABANG',
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
        horizontal: 'center',
        vertical: 'middle',
      };

      // if (index === 2) {
      //   cell.alignment = { horizontal: 'right', vertical: 'middle' };
      //   cell.numFmt = '0'; // angka polos tanpa ribuan / desimal
      // } else {
      //   cell.alignment = {
      //     horizontal: index === 0 ? 'right' : 'left',
      //     vertical: 'middle',
      //   };
      // }

      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    data.forEach((row, rowIndex) => {
      const currentRow = rowIndex + 6;
      const rowValues = [
        rowIndex + 1,
        row.type_nama,
        row.coa,
        row.parent,
        row.level,
        row.keterangancoa,
        row.cabang_nama,
        row.statusaktif_nama,
      ];

      rowValues.forEach((value, colIndex) => {
        const cell = worksheet.getCell(currentRow, colIndex + 1);

        if (colIndex === 4) {
          cell.value = Number(value);
          cell.numFmt = '0'; // format angka dengan ribuan
          cell.alignment = {
            horizontal: 'right',
            vertical: 'middle',
          };
        } else {
          cell.value = value ?? '';
          cell.alignment = {
            horizontal: colIndex === 0 ? 'right' : 'left',
            vertical: 'middle',
          };
        }

        // cell.value = value ?? '';
        cell.font = { name: 'Tahoma', size: 10 };
        // cell.alignment = {
        //   horizontal: colIndex === 0 ? 'right' : 'left',
        //   vertical: 'middle',
        // };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

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

    worksheet.getColumn(1).width = 6;

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_akun_pusat_${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath;
  }
}
