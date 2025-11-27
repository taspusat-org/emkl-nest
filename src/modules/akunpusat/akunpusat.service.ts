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

      // Get all data to find the position of new item
      const { data: allData } = await this.findAll(
        {
          search,
          filters,
          pagination: { page: 1, limit: 0 },
          sort: { sortBy, sortDirection },
          isLookUp: false,
        },
        trx,
      );

      // Find the index of the new item in all data
      let itemIndex = allData.findIndex((item) => item.id === newItem.id);
      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const itemsPerPage = limit || 10;
      const pageNumber = Math.floor(itemIndex / itemsPerPage) + 1;

      // Fetch data from page 1 to pageNumber
      const fetchedData: any[] = [];
      const fetchedPages: number[] = [];

      for (let pageNum = 1; pageNum <= pageNumber; pageNum++) {
        const { data: pageData } = await this.findAll(
          {
            search,
            filters,
            pagination: { page: pageNum, limit: itemsPerPage },
            sort: { sortBy, sortDirection },
            isLookUp: false,
          },
          trx,
        );

        if (pageData.length > 0) {
          fetchedData.push(...pageData);
          fetchedPages.push(pageNum);
        }
      }

      // Calculate itemIndex from fetchedData (position in all fetched pages from 1 to pageNumber)
      const fetchedItemIndex = fetchedData.findIndex(
        (item) => item.id === newItem.id,
      );

      // Store fetched data in Redis (data from page 1 to pageNumber)
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(fetchedData),
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
        itemIndex: fetchedItemIndex,
        fetchedPages, // Array of page numbers that were fetched [1, 2, 3, ..., pageNumber]
      };
    } catch (error) {
      throw new Error(`Error creating parameter: ${error.message}`);
    }
  }

  async findAll(
    { search, filters = {}, pagination = {}, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      const { page = 1, limit = 0 } = pagination;
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
      ];

      // Fungsi helper untuk membuat base query dengan semua filter
      const buildBaseQuery = (selectColumns = false) => {
        const query = selectColumns
          ? trx(`${this.tableName} as u`)
              .select([
                'u.id as id',
                'u.type_id',
                'u.level',
                'u.coa',
                'u.keterangancoa',
                'u.statusaktif',
                'p.text as statusaktif_nama',
                'p.memo',
                'u.parent',
                'u.cabang_id',
                'c.nama as cabang_nama',
                't.nama as type_nama',
                'u.info',
                'u.modifiedby',
                'u.created_at',
                'u.updated_at',
              ])
              .leftJoin('cabang as c', 'u.cabang_id', 'c.id')
              .leftJoin('typeakuntansi as t', 'u.type_id', 't.id')
              .leftJoin('parameter as p', 'u.statusaktif', 'p.id')
          : trx(`${this.tableName} as u`)
              .leftJoin('cabang as c', 'u.cabang_id', 'c.id')
              .leftJoin('typeakuntansi as t', 'u.type_id', 't.id')
              .leftJoin('parameter as p', 'u.statusaktif', 'p.id');

        return query;
      };

      // Fungsi helper untuk menerapkan semua filter (synchronous, returns query)
      const applyFilters = (query, tempParent?: string) => {
        // Apply isLookUp filter if needed
        if (isLookUp && tempParent) {
          query = query
            .leftOuterJoin(trx.raw(`${tempParent} as b`), 'u.coa', 'b.coa')
            .whereRaw(`ISNULL(b.coa, '') = ''`);
        }

        // Apply search filtering
        if (search) {
          const sanitizedValue = String(search).replace(/\[/g, '[[]');
          const searchableFields = ['coa', 'keterangancoa'];
          query.where((builder) => {
            searchableFields.forEach((field) =>
              builder.orWhere(`u.${field}`, 'like', `%${sanitizedValue}%`),
            );
          });
        }

        // Apply other filters
        Object.entries(filters).forEach(([key, value]) => {
          if (excludedFields.includes(key) || !value) return;
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (key === 'created_at' || key === 'updated_at') {
            query.andWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
              key,
              `%${sanitizedValue}%`,
            ]);
          } else if (key === 'type_nama') {
            query.andWhere(`t.nama`, 'like', `%${sanitizedValue}%`);
          } else if (key === 'statusaktif_nama') {
            query.andWhere(`p.text`, 'like', `%${sanitizedValue}%`);
          } else if (key === 'cabang_nama') {
            query.andWhere(`c.nama`, 'like', `%${sanitizedValue}%`);
          } else {
            query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
          }
        });

        return query;
      };

      let tempParent: string | undefined;

      // If isLookUp is true, apply the specific logic for lookups
      if (isLookUp) {
        const acoCountResult = await trx(this.tableName)
          .count('id as total')
          .first();
        const acoCount = acoCountResult?.total || 0;

        if (Number(acoCount) > 500) {
          return { data: { type: 'json' } };
        }

        // Create temporary table for LookUp query
        tempParent = `##temp_${Math.random().toString(36).substring(2, 15)}`;
        await trx.schema.createTable(tempParent, (t) =>
          t.string('coa').nullable(),
        );
        await trx(tempParent).insert(
          trx
            .select('u.parent')
            .from(this.tableName + ' as u')
            .groupBy('u.parent'),
        );
      }

      // Build query untuk count dengan filter yang sama
      let countQuery = buildBaseQuery(false).count('u.id as total');
      countQuery = applyFilters(countQuery, tempParent);

      // Get total records SETELAH filter diterapkan
      const countResult = await countQuery.first();
      const total = countResult?.total || 0;

      // Build query untuk fetch data dengan filter yang sama
      let dataQuery = buildBaseQuery(true);
      dataQuery = applyFilters(dataQuery, tempParent);

      // Apply sorting
      if (sort?.sortBy && sort?.sortDirection) {
        dataQuery.orderBy(sort.sortBy, sort.sortDirection);
      }

      // Apply pagination
      if (limit > 0) {
        const offset = (page - 1) * limit;
        dataQuery.limit(limit).offset(offset);
      }

      // Fetch the data
      const data = await dataQuery;

      // Calculate total pages
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

      return {
        data,
        type: total > 500 ? 'json' : 'local',
        total,
        pagination: {
          currentPage: page,
          totalPages,
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
      let itemIndex = filteredData.findIndex((item) => Number(item.id) === id);
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
