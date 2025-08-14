import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePengembaliankasgantungheaderDto } from './dto/create-pengembaliankasgantungheader.dto';
import { UpdatePengembaliankasgantungheaderDto } from './dto/update-pengembaliankasgantungheader.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { dbMssql } from 'src/common/utils/db';
import { RedisService } from 'src/common/redis/redis.service';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import { PengembaliankasgantungdetailService } from '../pengembaliankasgantungdetail/pengembaliankasgantungdetail.service';

@Injectable()
export class PengembaliankasgantungheaderService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
    private readonly pengembaliankasgantungdetailService: PengembaliankasgantungdetailService,
  ) {}
  private readonly tableName = 'pengembaliankasgantungheader';
  async create(data: any, trx: any) {
    try {
      data.tglbukti = formatDateToSQL(String(data?.tglbukti)); // Fungsi untuk format
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        relasi_nama,
        bank_nama,
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

      const parameter = await trx('parameter')
        .select('*')
        .where('grp', 'PENERIMAAN GANTUNG')
        .first();

      const nomorBukti = await this.runningNumberService.generateRunningNumber(
        trx,
        parameter.grp,
        parameter.subgrp,
        this.tableName,
        insertData.tglbukti,
      );
      insertData.nobukti = nomorBukti;

      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      if (details.length > 0) {
        // Inject nobukti into each detail item
        const detailsWithNobukti = details.map((detail: any) => ({
          ...detail,
          nobukti: nomorBukti, // Inject nobukti into each detail
          kasgantung_nobukti: detail.nobukti, // Ensure kasgantung_nobukti is preserved
          modifiedby: data.modifiedby, // Ensure modifiedby is preserved
        }));

        // Pass the updated details with nobukti to the detail creation service
        await this.pengembaliankasgantungdetailService.create(
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
        (item) => Number(item.id) === newItem.id,
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
          postingdari: `ADD PENGEMBALIAN KAS GANTUNG HEADER`,
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
  async update(id: any, data: any, trx: any) {
    try {
      console.log('data2', data);
      data.tglbukti = formatDateToSQL(String(data?.tglbukti)); // Fungsi untuk format

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        relasi_nama,
        bank_nama,
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
        const existingDetails = await trx('pengembaliankasgantungdetail').where(
          'pengembaliankasgantung_id',
          id,
        );
        const updatedDetails = details.map((detail: any) => {
          const existingDetail = existingDetails.find(
            (existing: any) => existing.nobukti === detail.nobukti,
          );

          if (existingDetail) {
            // If the nobukti exists, assign the id from the existing record
            detail.id = existingDetail.id;
            detail.kasgantung_nobukti = detail.nobukti; // Ensure nobukti is preserved
            detail.nobukti = existingData.nobukti; // Ensure nobukti is preserved
            detail.modifiedby = data.modifiedby; // Ensure modifiedby is preserved
          } else {
            // If nobukti does not exist, set id to 0
            detail.id = 0;
            detail.kasgantung_nobukti = detail.nobukti; // Ensure nobukti is preserved
            detail.nobukti = existingData.nobukti; // Ensure nobukti is preserved
            detail.modifiedby = data.modifiedby; // Ensure modifiedby is preserved
          }

          return detail;
        });
        if (updatedDetails.length > 0) {
          await this.pengembaliankasgantungdetailService.create(
            updatedDetails,
            id,
            trx,
          );
        }
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
          postingdari: `ADD PENGEMBALIAN KAS GANTUNG HEADER`,
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

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      let { page, limit } = pagination;

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
          'u.keterangan', // keterangan (nvarchar(max))
          'u.bank_id', // bank_id (integer)
          'u.penerimaan_nobukti', // penerimaan_nobukti (nvarchar(100))
          'u.coakasmasuk', // coakasmasuk (nvarchar(100))
          'u.relasi_id', // relasi_id (integer)
          'u.info', // info (nvarchar(max))
          'u.modifiedby', // modifiedby (varchar(200))
          'u.editing_by', // editing_by (varchar(200))
          trx.raw('r.nama as relasi_nama'), // relasi_nama (nvarchar(max))
          trx.raw('b.nama as bank_nama'),
          trx.raw("FORMAT(u.editing_at, 'dd-MM-yyyy HH:mm:ss') as editing_at"), // editing_at (datetime)
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"), // created_at (datetime)
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"), // updated_at (datetime)
        ])
        .leftJoin('relasi as r', 'u.relasi_id', 'r.id')
        .leftJoin('bank as b', 'u.bank_id', 'b.id')
        .leftJoin('akunpusat as ap', 'u.coakasmasuk', 'ap.coa');
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
      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }
      const excludeSearchKeys = ['tglDari', 'tglSampai'];
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
            continue; // Lewati filter jika key adalah 'tglDari' atau 'tglSampai'
          }

          if (value) {
            if (
              key === 'created_at' ||
              key === 'updated_at' ||
              key === 'editing_at'
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
  async findAllReport(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      let { page, limit } = pagination;

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
          'u.tglbukti', // tglbukti (date)
          'u.keterangan', // keterangan (nvarchar(max))
          'u.bank_id', // bank_id (integer)
          'u.penerimaan_nobukti', // penerimaan_nobukti (nvarchar(100))
          'u.coakasmasuk', // coakasmasuk (nvarchar(100))
          'u.relasi_id', // relasi_id (integer)
          'u.info', // info (nvarchar(max))
          'u.modifiedby', // modifiedby (varchar(200))
          'u.editing_by', // editing_by (varchar(200))
          trx.raw('r.nama as relasi_nama'), // relasi_nama (nvarchar(max))
          trx.raw('b.nama as bank_nama'),
          trx.raw("FORMAT(u.editing_at, 'dd-MM-yyyy HH:mm:ss') as editing_at"), // editing_at (datetime)
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"), // created_at (datetime)
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"), // updated_at (datetime)
        ])
        .leftJoin('relasi as r', 'u.relasi_id', 'r.id')
        .leftJoin('bank as b', 'u.bank_id', 'b.id')
        .leftJoin('akunpusat as ap', 'u.coakasmasuk', 'ap.coa');

      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('u.nobukti', 'like', `%${sanitizedValue}%`)
            .orWhere('u.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('u.penerimaan_nobukti', 'like', `%${sanitizedValue}%`)
            .orWhere('u.coakasmasuk', 'like', `%${sanitizedValue}%`)
            .orWhere('u.info', 'like', `%${sanitizedValue}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (
              key === 'created_at' ||
              key === 'updated_at' ||
              key === 'editing_at'
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
      const data: Array<any> = await query;
      const headerIds = data.map((h) => h.id);

      // 2) Jika tidak ada header, langsung return dengan details kosong
      if (headerIds.length === 0) {
        return {
          data: data.map((h) => ({ ...h, details: [] })),
          type: Number(data.length) > 500 ? 'json' : 'local',
          total: data.length,
          pagination: {
            /* ... */
          },
        };
      }

      // 3) Ambil semua detail yang terhubung ke header-header tersebut
      const detailRows = await trx('pengembaliankasgantungdetail')
        .select([
          'id',
          'pengembaliankasgantung_id',
          'nobukti',
          'kasgantung_nobukti',
          'keterangan',
          'nominal',
          'info',
          'modifiedby',
          'editing_by',
          trx.raw("FORMAT(editing_at, 'dd-MM-yyyy HH:mm:ss') as editing_at"),
          trx.raw("FORMAT(created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
        ])
        .whereIn('pengembaliankasgantung_id', headerIds);

      // 4) Group detail berdasarkan pengembaliankasgantung_id
      const detailsByHeader = detailRows.reduce(
        (acc, detail) => {
          const key = detail.pengembaliankasgantung_id;
          if (!acc[key]) acc[key] = [];
          acc[key].push(detail);
          return acc;
        },
        {} as Record<number, Array<any>>,
      );

      // 5) Satukan: tiap header dapat array details (atau [] jika tidak ada)
      const dataWithDetails = data.map((h) => ({
        ...h,
        details: detailsByHeader[h.id] || [],
      }));

      // 6) Hitung total & pagination seperti sebelumnya
      const resultCount = await trx(this.tableName)
        .count('id as total')
        .first();
      const total = Number(resultCount?.total || 0);
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

      return {
        data: dataWithDetails,
        type: total > 500 ? 'json' : 'local',
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

  findOne(id: number) {
    return `This action returns a #${id} pengembaliankasgantungheader`;
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
        'pengembaliankasgantungdetail',
        'pengembaliankasgantung_id',
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE PENGEMBALIAN KAS GANTUNG',
          idtrans: deletedData.id,
          nobuktitrans: deletedData.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedData),
          modifiedby: modifiedby,
        },
        trx,
      );
      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE PENGEMBALIAN KAS GANTUNG DETAIL',
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
}
