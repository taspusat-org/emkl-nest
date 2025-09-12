import { 
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Column, Workbook } from 'exceljs';
import { LocksService } from '../locks/locks.service';
import { UtilsService } from 'src/utils/utils.service';
import { GlobalService } from '../global/global.service';
import { RedisService } from 'src/common/redis/redis.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';

@Injectable()
export class PenerimaanEmklService {
  private readonly tableName: string = 'penerimaanemkl';

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly globalService: GlobalService,
    private readonly locksService: LocksService,
    private readonly logTrailService: LogtrailService,
    private readonly utilsService: UtilsService,
  ) {}

  async create(createData: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        method,
        coadebet_nama,
        coakredit_nama,
        coabankdebet_nama,
        coabankkredit_nama,
        coahutangdebet_nama,
        coahutangkredit_nama,
        format_nama,
        statusaktif_nama,
        id,
        ...insertData
      } = createData;

      insertData.updated_at = this.utilsService.getTime();
      insertData.created_at = this.utilsService.getTime();

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });

      const insertedData = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      const newItem = insertedData[0];

      const { data, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit: 0 },
          sort: { sortBy, sortDirection },
          isLookUp: false,
        },
        trx,
      );
      let dataIndex = data.findIndex((item) => item.id === newItem.id);
      if (dataIndex === -1) {
        dataIndex = 0;
      }

      // Optionally, you can find the page number or other info if needed
      const pageNumber = pagination?.currentPage;
      
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(data),
      );

      await this.logTrailService.create(
        {
          namatable: this.tableName,
          postingdari: 'ADD PENERIMAAN EMKL',
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
        dataIndex 
      };
    } catch (error) {
      throw new Error(`Error creating penerimaan emkl: ${error.message}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      let { page, limit } = pagination ?? {};
      page = page ?? 1;
      limit = 0;

      if (isLookUp) {
        const totalData = await trx(this.tableName)
          .count('id as total')
          .first();

        const resultTotalData = totalData?.total || 0;

        if (Number(resultTotalData) > 500) {
          return {
            data: {
              type: 'json',
            },
          };
        } else {
          limit = 0;
        }
      }

      const query = trx(`${this.tableName} as u`)
        .select([
          'u.id as id',
          'u.nama',
          'u.keterangan',
          'u.coadebet',
          'u.coakredit',
          'u.coapostingkasbankdebet',
          'u.coapostingkasbankkredit',
          'u.coapostinghutangdebet',
          'u.coapostinghutangkredit',
          'u.format',
          'u.statusaktif',
          'u.modifiedby',
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'coadebet.keterangancoa as coadebet_nama',
          'coakredit.keterangancoa as coakredit_nama',
          'coabankdebet.keterangancoa as coabankdebet_nama',
          'coabankkredit.keterangancoa as coabankkredit_nama',
          'coahutangdebet.keterangancoa as coahutangdebet_nama',
          'coahutangkredit.keterangancoa as coahutangkredit_nama',
          'p.text as format_nama',
          'q.memo',
          'q.text as statusaktif_nama',
        ])
        .leftJoin('akunpusat as coadebet', 'u.coadebet', 'coadebet.coa')
        .leftJoin('akunpusat as coakredit', 'u.coakredit', 'coakredit.coa')
        .leftJoin('akunpusat as coabankdebet', 'u.coapostingkasbankdebet', 'coabankdebet.coa')
        .leftJoin('akunpusat as coabankkredit', 'u.coapostingkasbankkredit', 'coabankkredit.coa')
        .leftJoin('akunpusat as coahutangdebet', 'u.coapostinghutangdebet', 'coahutangdebet.coa')
        .leftJoin('akunpusat as coahutangkredit', 'u.coapostinghutangkredit', 'coahutangkredit.coa')
        .leftJoin('parameter as p', 'u.format', 'p.id')
        .leftJoin('parameter as q', 'u.statusaktif', 'q.id');

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('u.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('u.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('coadebet.keterangancoa', 'like', `%${sanitizedValue}%`)
            .orWhere('coakredit.keterangancoa', 'like', `%${sanitizedValue}%`)
            .orWhere('coabankdebet.keterangancoa', 'like', `%${sanitizedValue}%`)
            .orWhere('coabankkredit.keterangancoa', 'like', `%${sanitizedValue}%`)
            .orWhere('coahutangdebet.keterangancoa', 'like', `%${sanitizedValue}%`)
            .orWhere('coahutangkredit.keterangancoa', 'like', `%${sanitizedValue}%`)
            .orWhere('p.text', 'like', `%${sanitizedValue}%`)
            .orWhere('u.modifiedby', 'like', `%${sanitizedValue}%`)
            .orWhere('u.created_at', 'like', `%${sanitizedValue}%`)
            .orWhere('u.updated_at', 'like', `%${sanitizedValue}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'created_at' || key === 'updated_at') {
              query.andWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
                key,
                `%${sanitizedValue}%`,
              ]);
            } else if (key === 'coadebet_text') {
              query.andWhere('coadebet.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (key === 'coakredit_text') {
              query.andWhere('coakredit.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (key === 'coabankdebet_text') {
              query.andWhere('coabankdebet.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (key === 'coabankkredit_text') {
              query.andWhere('coabankkredit.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (key === 'coahutangdebet_text') {
              query.andWhere('coahutangdebet.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (key === 'coahutangkredit_text') {
              query.andWhere('coahutangkredit.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (key === 'format_text') {
              query.andWhere('p.text', 'like', `%${sanitizedValue}%`);
            } else if (key === 'statusaktif_text') {
              query.andWhere(`q.id`, '=', sanitizedValue);
            }  else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      const result = await trx(this.tableName).count('id as total').first();
      const total = result?.total as number;
      const totalPages = Math.ceil(total / limit);

      if (sort?.sortBy && sort?.sortDirection) {
        if (sort?.sortBy === 'coadebet_text') {
          query.orderBy('coadebet.keterangancoa', sort.sortDirection);
        } else if (sort?.sortBy === 'coakredit_text') {
          query.orderBy('coakredit.keterangancoa', sort.sortDirection);          
        } else if (sort?.sortBy === 'coabankdebet_text') {
          query.orderBy('coabankdebet.keterangancoa', sort.sortDirection);          
        } else if (sort?.sortBy === 'coabankkredit_text') {
          query.orderBy('coabankkredit.keterangancoa', sort.sortDirection);          
        } else if (sort?.sortBy === 'coahutangdebet_text') {
          query.orderBy('coahutangdebet.keterangancoa', sort.sortDirection);          
        } else if (sort?.sortBy === 'coahutangkredit_text') {
          query.orderBy('coahutangkredit.keterangancoa', sort.sortDirection);          
        } else if (sort?.sortBy === 'format_text') {
          query.orderBy('q.text', sort.sortDirection);          
        } else {
          query.orderBy(sort.sortBy, sort.sortDirection);
        }
      }

      const data = await query;
      console.log('data', data);
      const responseType = Number(total) > 500 ? 'json' : 'local';

      return {
        data: data,
        type: responseType,
        total,
        pagination: {
          currentPage: Number(page),
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: limit > 0 ? limit : total,
        },
      };
    } catch (error) {
      console.error('Error to findAll Penerimaan Emkl', error);
      throw new Error(error);
    }
  }

  async update(dataId: number, data: any, trx: any) {
    try {
      const existingData = await trx(this.tableName)
        .where('id', dataId)
        .first();

      if (!existingData) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Data Not Found!',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        coadebet_nama,
        coakredit_nama,
        coabankdebet_nama,
        coabankkredit_nama,
        coahutangdebet_nama,
        coahutangkredit_nama,
        format_nama,
        statusaktif_nama,
        id,
        method,
        ...updateData
      } = data;

      Object.keys(updateData).forEach((key) => {
        if (typeof updateData[key] === 'string') {
          updateData[key] = updateData[key].toUpperCase();
        }
      });

      const hasChanges = this.utilsService.hasChanges(updateData, existingData);

      if (hasChanges) {
        updateData.updated_at = this.utilsService.getTime();
        await trx(this.tableName).where('id', dataId).update(updateData);
      }

      const { data: filteredData, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit: 0 },
          sort: { sortBy, sortDirection },
          isLookUp: false,
        },
        trx,
      );

      let dataIndex = filteredData.findIndex(
        (item) => Number(item.id) === Number(dataId),
      );

      if (dataIndex === -1) {
        dataIndex = 0;
      }

      if (dataIndex === -1) {
        throw new Error('Updated item not found in all items');
      }

      const itemsPerPage = limit || 30;
      const pageNumber = Math.floor(dataIndex / itemsPerPage) + 1;

      // ambil data hingga halaman yg mencakup item yg baru diupdate
      const endIndex = pageNumber * itemsPerPage;
      const limitedItems = filteredData.slice(0, endIndex);

      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'EDIT PENERIMAAN EMKL',
          idtrans: dataId,
          nobuktitrans: dataId,
          aksi: 'EDIT',
          datajson: JSON.stringify(data),
          modifiedby: data.modifiedby,
        },
        trx,
      );

      return {
        newItems: {
          dataId,
          ...data,
        },
        pageNumber,
        dataIndex,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      console.error('Error updating penerimaan emkl:', error);
      throw new Error('Failed to update penerimaan emkl');
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
          postingdari: 'DELETE PENERIMAAN EMKL',
          idtrans: id,
          nobuktitrans: id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedData),
          modifiedby: modifiedby,
        },
        trx,
      );

      return {
        status: 200,
        message: 'Data deleted successfully',
        deletedData,
      };
    } catch (error) {
      console.error('Error deleting data: ', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete data');
    }
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
        return {
          status: 'success',
          message: 'Data aman untuk dihapus.',
        };
      }
    } catch (error) {
      console.error('Error di checkValidasi:', error);
      throw new InternalServerErrorException('Failed to check validation');
    }
  }

  async exportToExcel(data: any[]) {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Data Export');

    worksheet.mergeCells('A1:K1');
    worksheet.mergeCells('A2:K2');
    worksheet.mergeCells('A3:K3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN PENERIMAAN EMKL';
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
      'COA DEBET',
      'COA KREDIT',
      'COA POSTING KASBANK DEBET',
      'COA POSTING KASBANK KREDIT',
      'COA POSTING HUTANG DEBET',
      'COA POSTING HUTANG KREDIT',
      'FORMAT',
      'STATUS AKTIF'
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
      const rowValues = [
        rowIndex + 1,
        row.nama,
        row.keterangan,
        row.coadebet_nama,
        row.coakredit_nama,
        row.coabankdebet_nama,
        row.coabankkredit_nama,
        row.coahutangdebet_nama,
        row.coahutangkredit_nama,
        row.format_nama,
        row.statusaktif_nama
      ];
      rowValues.forEach((value, colIndex) => {
        const cell = worksheet.getCell(currentRow, colIndex + 1);
        cell.value = value ?? '';
        cell.font = { name: 'Tahoma', size: 10 };
        cell.alignment = {
          horizontal: colIndex === 0 ? 'right' : 'left',
          vertical: 'middle',
        };
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
    worksheet.getColumn(4).width = 20;

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_penerimaan_emkl_${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath;
  }
}
