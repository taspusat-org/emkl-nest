import {
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook } from 'exceljs';
import { dbMssql } from 'src/common/utils/db';
import { UtilsService } from 'src/utils/utils.service';
import { GlobalService } from '../global/global.service';
import { RedisService } from 'src/common/redis/redis.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { LocksService } from '../locks/locks.service';

@Injectable()
export class TypeAkuntansiService {
  private readonly tableName: string = 'typeakuntansi';

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilService: UtilsService,
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
        statusaktif_text,
        akuntansi_nama,
        id,
        ...insertData
      } = createData;
      console.log('insertData', insertData);
      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });

      const insertedData = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      const newData = insertedData[0];

      // Ambil data utk dimasukkan ke temp table
      // ==== NEW ==== kalau kamu sudah menambahkan flag forTemp di findAll,
      // set forTemp: true agar created_at/updated_at tidak di-FORMAT dan kolom ekstra tidak dipilih
      const { data, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit: 0 },
          sort: { sortBy, sortDirection },
          isLookUp: false,
          // forTemp: true, // <-- aktifkan kalau kamu sudah implement opsi ini di findAll
        },
        trx,
      );
      console.log('data', data.length);
      console.log('pagination222', pagination);
      // ==== NEW ==== buat nama temp table (pakai # cukup, biar scope-nya tetap di connection trx)
      const tempTableName = `##temp_${Math.random().toString(36).slice(2)}`;

      // ==== NEW ==== buat DDL temp table dari skema tabel asli (pakai createTempTable yg sudah diperbaiki)
      const ddl = await this.utilsService.createTempTable(
        this.tableName,
        trx,
        tempTableName,
      );
      await trx.raw(ddl);

      // ==== NEW ==== ambil daftar kolom asli, untuk mem-"pick" kolom yang valid saja
      const colInfo = await trx(this.tableName).columnInfo();
      const baseCols = Object.keys(colInfo);

      // ==== NEW ==== normalisasi baris yang akan di-insert ke temp:
      // - drop kolom ekstra yang tidak ada di tabel asli (memo, statusaktif_text, akuntansi_nama, dll)
      // - parse tanggal kalau keburu diformat string (dd-MM-yyyy HH:mm:ss)
      const rowsForTemp = data.map((row: any) => {
        const obj: any = {};
        for (const c of baseCols) {
          let v = row[c];
          if (
            (c === 'created_at' || c === 'updated_at') &&
            typeof v === 'string'
          ) {
            // parse "dd-MM-yyyy HH:mm:ss" -> Date, agar MSSQL bisa masuk ke datetime/datetime2
            // contoh robust parsing
            const m = v.match(
              /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/,
            );
            if (m) {
              const [_, dd, MM, yyyy, HH, mm, ss] = m;
              v = new Date(
                Number(yyyy),
                Number(MM) - 1,
                Number(dd),
                Number(HH),
                Number(mm),
                Number(ss),
                0,
              );
            }
          }
          obj[c] = v ?? null;
        }
        return obj;
      });

      // const filteredData = await query; // ambil hasil query yg udh di filter

      // cari index data baru di hasil query yg udh di filter
      let dataIndex = data.findIndex((item) => item.id === newData.id);

      if (dataIndex === -1) {
        dataIndex = 0;
      }

      const pageNumber = Math.floor(dataIndex / limit) + 1;
      const endIndex = pageNumber * limit;
      const limitedItems = data.slice(0, endIndex); // ambil data hingga halaman yang mencakup data baru

      // simpan cache & log seperti sebelumnya
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.logTrailService.create(
        {
          namatable: this.tableName,
          postingdari: 'ADD TYPE AKUNTANSI',
          idtrans: newData.id,
          nobuktitrans: newData.id,
          aksi: 'ADD',
          datajson: JSON.stringify(newData),
          modifiedby: newData.modifiedby,
        },
        trx,
      );

      return { newData };
    } catch (error) {
      throw new Error(`Error creating type akuntansi: ${error.message}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      console.log('pagination', pagination);
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
          'u.order',
          'u.keterangan',
          'u.akuntansi_id',
          'u.statusaktif',
          'u.modifiedby',
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'p.memo',
          'p.text as statusaktif_text',
          'ak.nama as akuntansi_nama',
        ])
        .leftJoin('parameter as p', 'u.statusaktif', 'p.id')
        .leftJoin('akuntansi as ak', 'u.akuntansi_id', 'ak.id');

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('u.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('u.order', 'like', `%${sanitizedValue}%`)
            .orWhere('u.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('ak.nama', 'like', `%${sanitizedValue}%`)
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
            } else if (key === 'statusaktif_text' || key === 'memo') {
              query.andWhere(`p.text`, '=', sanitizedValue);
            } else if (key === 'akuntansi') {
              query.andWhere('ak.nama', 'like', `%${sanitizedValue}%`);
            } else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }
      // console.log('KENAPA DATANYA KOSONG', await query, search, filters, pagination, sort, limit);
      // console.log('KENAPA DATANYA KOSONG', await query, filters);

      const result = await trx(this.tableName).count('id as total').first();
      const total = result?.total as number;
      // const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
      const totalPages = Math.ceil(total / limit);

      if (sort?.sortBy && sort?.sortDirection) {
        query.orderBy(sort.sortBy, sort.sortDirection);
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
      console.error('Error to findAll Type Akuntansi', error);
      throw new Error(error);
    }
  }

  // async findAllByIds(ids: { id: number }[]) {
  //   try {
  //     const idList = ids.map((item) => item.id)

  //     const tempData = `##temp_${Math.random().toString(36).substring(2, 15)}`;

  //     // Membuat temporary table
  //     const createTempTableQuery = `CREATE TABLE ${tempData} (id INT);`;
  //     await dbMssql.raw(createTempTableQuery);

  //     // Memasukkan data ID ke dalam temporary table
  //     const insertTempTableQuery = `
  //       INSERT INTO ${tempData} (id)
  //       VALUES ${idList.map((id) => `(${id})`).join(', ')};
  //     `;
  //     await dbMssql.raw(insertTempTableQuery);

  //     // Query utama dengan JOIN ke temporary table
  //     const query = dbMssql(`${this.tableName} as u`)
  //       .select([
  //         'u.id as id',
  //         'u.nama',
  //         'u.order',
  //         'u.keterangan',
  //         'u.akuntansi_id',
  //         'u.statusaktif',
  //         'u.modifiedby',
  //         dbMssql.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
  //         dbMssql.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
  //         'p.memo',
  //         'p.text',
  //         'q.nama'
  //       ])
  //       .join('parameter as p', 'u.statusaktif', 'p.id')
  //       // .leftJoin('akuntansi as q', 'u.akuntansi_id', 'q.id');
  //       .join(dbMssql.raw(`${tempData} as temp`), 'u.id', 'temp.id') // Menggunakan JOIN antar tabel user dan temporary table
  //       .orderBy('u.nama', 'ASC');

  //     const data = await query;

  //     const dropTempTableQuery = `DROP TABLE ${tempData};`;
  //     await dbMssql.raw(dropTempTableQuery);

  //     return data;
  //   } catch (error) {
  //     console.error('Error fetching data:', error);
  //     throw new Error('Failed to fetch data');
  //   }
  // }

  async update(dataId: number, data: any, trx: any) {
    try {
      const existingData = await trx(this.tableName)
        .where('id', dataId)
        .first();

      if (!existingData) {
        // throw new Error('Data Not Found!');
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
        statusaktif_text,
        akuntansi_nama,
        id,
        ...updateData
      } = data;

      Object.keys(updateData).forEach((key) => {
        if (typeof updateData[key] === 'string') {
          updateData[key] = updateData[key].toUpperCase();
        }
      });

      const hasChanges = this.utilService.hasChanges(updateData, existingData);

      if (hasChanges) {
        updateData.updated_at = this.utilService.getTime();
        await trx(this.tableName).where('id', id).update(updateData);
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
        (item) => Number(item.id) === Number(id),
      );
      if (dataIndex === -1) {
        dataIndex = 0;
      }
      // console.log('all dataa', filteredData, 'dataIndex', dataIndex);

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
          postingdari: 'EDIT TYPE AKUNTANSI',
          idtrans: id,
          nobuktitrans: id,
          aksi: 'EDIT',
          datajson: JSON.stringify(data),
          modifiedby: data.modifiedby,
        },
        trx,
      );

      return {
        newItems: {
          id,
          ...data,
        },
        pageNumber,
        dataIndex,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      console.error('Error updating type akuntansi:', error);
      throw new Error('Failed to update ccemail');
    }
  }

  async delete(id: number, trx: any, modifiedby: string) {
    try {
      const deletedData = await this.utilService.lockAndDestroy(
        id,
        this.tableName,
        'id',
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE TYPE AKUNTANSI',
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
        const validasi = await this.globalService.checkUsed(
          'akunpusat',
          'type_id',
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

  async exportToExcel(data: any[]) {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Data Export');

    worksheet.mergeCells('A1:D1');
    worksheet.mergeCells('A2:D2');
    worksheet.mergeCells('A3:D3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN TYPE AKUNTANSI';
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

    // Mendefinisikan header kolom
    const headers = [
      'No.',
      'Nama',
      'Order',
      'Keterangan',
      'Akuntansi',
      'Status Aktif',
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

    // Mengisi data ke dalam Excel dengan nomor urut sebagai ID
    data.forEach((row, rowIndex) => {
      worksheet.getCell(rowIndex + 6, 1).value = rowIndex + 1; // Nomor urut (ID)
      worksheet.getCell(rowIndex + 6, 2).value = row.nama;
      worksheet.getCell(rowIndex + 6, 3).value = row.email;
      worksheet.getCell(rowIndex + 6, 4).value = row.text;

      // Menambahkan border untuk setiap cell
      for (let col = 1; col <= headers.length; col++) {
        const cell = worksheet.getCell(rowIndex + 6, col);
        cell.font = { name: 'Tahoma', size: 10 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    });

    // Mengatur lebar kolom
    worksheet.getColumn(1).width = 10; // Lebar untuk nomor urut
    worksheet.getColumn(2).width = 30;
    worksheet.getColumn(3).width = 30;
    worksheet.getColumn(4).width = 30;
    worksheet.getColumn(5).width = 15;
    worksheet.getColumn(6).width = 20;
    worksheet.getColumn('F').numFmt = 'dd-mm-yyyy hh:mm:ss';

    // Simpan file Excel ke direktori sementara
    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_ccemail${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath; // Kembalikan path file sementara
  }
}
