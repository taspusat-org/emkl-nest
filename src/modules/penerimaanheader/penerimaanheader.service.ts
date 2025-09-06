import {
  Inject,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreatePenerimaanheaderDto } from './dto/create-penerimaanheader.dto';
import { UpdatePenerimaanheaderDto } from './dto/update-penerimaanheader.dto';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import { PenerimaandetailService } from '../penerimaandetail/penerimaandetail.service';
import { LocksService } from '../locks/locks.service';
import { GlobalService } from '../global/global.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';

@Injectable()
export class PenerimaanheaderService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly logTrailService: LogtrailService,
    private readonly utilsService: UtilsService,
    private readonly runningNumberService: RunningNumberService,
    private readonly penerimaandetailService: PenerimaandetailService,
  ) {}
  private readonly tableName = 'penerimaanheader';
  async create(data: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        relasi_nama,
        alatbayar_nama,
        penerimaan_nobukti,
        bank_nama,
        details,
        ...insertData
      } = data;

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });
      console.log('insertData', insertData);

      insertData.tglbukti = await formatDateToSQL(String(insertData?.tglbukti)); // Fungsi untuk format
      insertData.tgllunas = await formatDateToSQL(String(insertData?.tgllunas)); // Fungsi untuk format
      console.log('insertData222', insertData);

      console.log('data', data);
      const memoExpr = 'TRY_CONVERT(nvarchar(max), memo)'; // penting: TEXT/NTEXT -> nvarchar(max)
      const parameterCabang = await trx('parameter')
        .select(trx.raw(`JSON_VALUE(${memoExpr}, '$.CABANG_ID') AS cabang_id`))
        .where('grp', 'CABANG')
        .andWhere('subgrp', 'CABANG')
        .first();
      const formatpenerimaan = await trx(`bank as b`)
        .select('p.grp', 'p.subgrp', 'b.formatpenerimaan')
        .leftJoin('parameter as p', 'p.id', 'b.formatpenerimaan')
        .where('b.id', insertData.bank_id)
        .first();
      const grp = formatpenerimaan.grp;
      const subgrp = formatpenerimaan.subgrp;
      const cabangId = parameterCabang.cabang_id;

      const nomorBukti = await this.runningNumberService.generateRunningNumber(
        trx,
        grp,
        subgrp,
        this.tableName,
        insertData.tglbukti,
        cabangId,
      );
      insertData.nobukti = nomorBukti;
      insertData.statusformat = formatpenerimaan.formatpenerimaan;
      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      if (details.length > 0) {
        // Inject nobukti into each detail item
        const detailsWithNobukti = details.map((detail: any) => ({
          ...detail,
          nobukti: nomorBukti, // Inject nobukti into each detail
          modifiedby: insertData.modifiedby,
        }));

        // Pass the updated details with nobukti to the detail creation service
        await this.penerimaandetailService.create(
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
          postingdari: `ADD PENERIMAAN HEADER`,
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

      // Query sesuai dengan struktur tabel pada gambar
      const query = trx(`${this.tableName} as u`)
        .select([
          'u.id as id',
          'u.nobukti',
          trx.raw("FORMAT(u.tglbukti, 'dd-MM-yyyy') as tglbukti"),
          'u.relasi_id',
          'u.keterangan',
          'u.bank_id',
          'u.postingdari',
          'u.coakasmasuk',
          'u.diterimadari',
          'u.alatbayar_id',
          'u.nowarkat',
          trx.raw("FORMAT(u.tgllunas, 'dd-MM-yyyy') as tgllunas"),
          'u.noresi',
          'u.statusformat',
          'u.info',
          'u.modifiedby',
          'r.nama as relasi_nama',
          'b.nama as bank_nama',
          'ab.nama as alatbayar_nama',
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
        ])
        .leftJoin('relasi as r', 'u.relasi_id', 'r.id')
        .leftJoin('bank as b', 'u.bank_id', 'b.id')
        .leftJoin('alatbayar as ab', 'u.alatbayar_id', 'ab.id');

      // Filter tanggal jika ada
      if (filters?.tglDari && filters?.tglSampai) {
        const tglDariFormatted = formatDateToSQL(String(filters?.tglDari));
        const tglSampaiFormatted = formatDateToSQL(String(filters?.tglSampai));
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

      // Field yang bisa dicari
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

      // Filtering berdasarkan kolom tabel
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (key === 'tglDari' || key === 'tglSampai') continue;
          if (value) {
            if (
              key === 'created_at' ||
              key === 'updated_at' ||
              key === 'tgllunas' ||
              key === 'tglbukti'
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
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

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
        relasi_nama,
        bank_nama,
        alatbayar_nama,
        daftarbank_nama,
        coakredit_nama,
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
        const detailsWithNobukti = details.map((detail: any) => ({
          ...detail,
          nobukti: existingData.nobukti, // Inject nobukti into each detail
          modifiedby: insertData.modifiedby,
        }));

        await this.penerimaandetailService.create(detailsWithNobukti, id, trx);
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
      let itemIndex = filteredItems.findIndex(
        (item) => Number(item.id) === Number(id),
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
          postingdari: `EDIT PENERIMAAN HEADER`,
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
        'penerimaandetail',
        'penerimaan_id',
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE PENERIMAAN DETAIL',
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
  async findOne(id: string, trx: any) {
    try {
      const query = trx(`${this.tableName} as u`)
        .select([
          'u.id as id',
          'u.nobukti',
          trx.raw("FORMAT(u.tglbukti, 'dd-MM-yyyy') as tglbukti"),
          'u.relasi_id',
          'u.keterangan',
          'u.bank_id',
          'u.postingdari',
          'u.coakasmasuk',
          'u.diterimadari',
          'u.alatbayar_id',
          'u.nowarkat',
          trx.raw("FORMAT(u.tgllunas, 'dd-MM-yyyy') as tgllunas"),
          'u.noresi',
          'u.statusformat',
          'u.info',
          'u.modifiedby',
          'r.nama as relasi_nama',
          'b.nama as bank_nama',
          'ab.nama as alatbayar_nama',
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
        ])
        .leftJoin('relasi as r', 'u.relasi_id', 'r.id')
        .leftJoin('bank as b', 'u.bank_id', 'b.id')
        .leftJoin('alatbayar as ab', 'u.alatbayar_id', 'ab.id')
        .where('u.id', id);

      const data = await query;

      return {
        data: data,
      };
    } catch (error) {
      console.error('Error fetching data:', error);
      throw new Error('Failed to fetch data');
    }
  }

  remove(id: number) {
    return `This action removes a #${id} penerimaanheader`;
  }
}
