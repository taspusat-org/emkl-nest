import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateKasgantungheaderDto } from './dto/create-kasgantungheader.dto';
import { UpdateKasgantungheaderDto } from './dto/update-kasgantungheader.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import { PengembaliankasgantungdetailService } from '../pengembaliankasgantungdetail/pengembaliankasgantungdetail.service';
import { KasgantungdetailService } from '../kasgantungdetail/kasgantungdetail.service';
import { GlobalService } from '../global/global.service';
import { LocksService } from '../locks/locks.service';

@Injectable()
export class KasgantungheaderService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
    private readonly kasgantungdetailService: KasgantungdetailService,
    private readonly locksService: LocksService,
    private readonly globalService: GlobalService,
  ) {}
  private readonly tableName = 'kasgantungheader';
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
        alatbayar_nama,
        bank_nama,
        details,
        ...insertData
      } = data;

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });
      console.log('masuk');
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
          modifiedby: insertData.modifiedby,
        }));

        // Pass the updated details with nobukti to the detail creation service
        await this.kasgantungdetailService.create(
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
          postingdari: `ADD KAS GANTUNG HEADER`,
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
          'u.relasi_id', // relasi_id (integer)
          'u.bank_id', // bank_id (integer)
          'u.pengeluaran_nobukti', // pengeluaran_nobukti (nvarchar(100))
          'u.coakaskeluar', // coakaskeluar (nvarchar(100))
          'u.dibayarke', // dibayarke (nvarchar(max))
          'u.alatbayar_id', // alatbayar_id (integer)
          'u.nowarkat', // nowarkat (nvarchar(100))
          'u.tgljatuhtempo', // tgljatuhtempo (date)
          'u.gantungorderan_nobukti', // gantungorderan_nobukti (nvarchar(100))
          'u.info', // info (nvarchar(max))
          'u.modifiedby', // modifiedby (varchar(200))
          'u.editing_by', // editing_by (varchar(200))
          'r.nama as relasi_nama', // relasi_nama (varchar(200))
          'b.nama as bank_nama', // bank_nama (varchar(200))
          'ab.nama as alatbayar_nama', // alatbayar_nama (varchar(200))
          trx.raw("FORMAT(u.editing_at, 'dd-MM-yyyy HH:mm:ss') as editing_at"), // editing_at (datetime)
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"), // created_at (datetime)
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"), // updated_at (datetime)
        ])
        .leftJoin('relasi as r', 'u.relasi_id', 'r.id')
        .leftJoin('bank as b', 'u.bank_id', 'b.id')
        .leftJoin('alatbayar as ab', 'u.alatbayar_id', 'ab.id');

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
      const excludeSearchKeys = ['tglDari', 'tglSampai'];
      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }
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

          // Menambahkan pengecualian untuk 'tglDari' dan 'tglSampai'
          if (key === 'tglDari' || key === 'tglSampai') {
            continue; // Lewati filter jika key adalah 'tglDari' atau 'tglSampai'
          }

          if (value) {
            if (
              key === 'created_at' ||
              key === 'updated_at' ||
              key === 'editing_at' ||
              key === 'tglbukti' ||
              key === 'tgljatuhtempo'
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

  async getKasGantung(dari: any, sampai: any, trx: any) {
    try {
      const tglDariFormatted = formatDateToSQL(dari);
      const tglSampaiFormatted = formatDateToSQL(sampai);
      const temp = '##temp_' + Math.random().toString(36).substring(2, 8);
      await trx.schema.createTable(temp, (t) => {
        t.string('nobukti');
        t.date('tglbukti');
        t.bigInteger('sisa').nullable();
        t.text('keterangan').nullable();
      });
      await trx(temp).insert(
        trx
          .select(
            'kd.nobukti',
            trx.raw('CAST(kg.tglbukti AS DATE) AS tglbukti'),
            trx.raw(`
              (SELECT (sum(kd.nominal) - COALESCE(SUM(pgd.nominal), 0)) 
               FROM pengembaliankasgantungdetail as pgd 
               WHERE pgd.kasgantung_nobukti = kd.nobukti) AS sisa, 
              MAX(kd.keterangan)
            `),
          )
          .from('kasgantungdetail as kd')
          .leftJoin('kasgantungheader as kg', 'kg.id', 'kd.kasgantung_id')
          .whereBetween('kg.tglbukti', [tglDariFormatted, tglSampaiFormatted])
          .groupBy('kd.nobukti', 'kg.tglbukti')
          .orderBy('kg.tglbukti', 'asc')
          .orderBy('kd.nobukti', 'asc'),
      );
      const result = trx
        .select(
          trx.raw(`row_number() OVER (ORDER BY ??) as id`, [`${temp}.nobukti`]),
          trx.raw(`FORMAT([${temp}].[tglbukti], 'dd-MM-yyyy') as tglbukti`),
          `${temp}.nobukti`,
          `${temp}.sisa`,
          `${temp}.keterangan as keterangan`,
        )

        .from(trx.raw(`${temp} with (readuncommitted)`))
        .where(function () {
          this.whereRaw(`${temp}.sisa != 0`).orWhereRaw(`${temp}.sisa is null`);
        });

      return result;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw new Error('Failed to fetch data');
    }
  }
  async getPengembalian(id: any, dari: any, sampai: any, trx: any) {
    try {
      // Create temporary tables
      const tempPribadi = await this.createTempPengembalianKasGantung(
        id,
        dari,
        sampai,
        trx,
      );
      const tempAll = await this.createTempPengembalian(id, dari, sampai, trx);

      const temp = '##tempGet' + Math.random().toString(36).substring(2, 8);
      // Fetch data from the personal temporary table
      const pengembalian = trx(tempPribadi).select(
        'pengembaliankasgantungheader_id',
        'nobukti',
        'tglbukti',
        'keterangan',
        'coa',
        'sisa',
        'bayar',
      );

      // Create a new temporary table
      await trx.schema.createTable(temp, (t) => {
        t.bigInteger('pengembaliankasgantungheader_id').nullable();
        t.string('nobukti');
        t.date('tglbukti').nullable();
        t.string('keterangan').nullable();
        t.string('coa').nullable();
        t.bigInteger('sisa').nullable();
        t.bigInteger('bayar').nullable();
      });

      // Insert fetched data into the new table
      await trx(temp).insert(pengembalian);

      // Fetch data from the second temporary table (tempAll)
      const pinjaman = trx(tempAll)
        .select(
          trx.raw('null as pengembaliankasgantungheader_id'),
          'nobukti',
          'tglbukti',
          'keterangan',
          trx.raw('null as coa'),
          'sisa',
          trx.raw('0 as bayar'),
        )
        .where(function () {
          this.whereRaw(`${tempAll}.sisa != 0`).orWhereRaw(
            `${tempAll}.sisa is null`,
          );
        });

      // Insert data from tempAll into the new temporary table
      await trx(temp).insert(pinjaman);

      // Final data query with row numbering
      const data = await trx
        .select(
          trx.raw(`row_number() OVER (ORDER BY ??) as id`, [`${temp}.nobukti`]),
          `${temp}.pengembaliankasgantungheader_id`,
          `${temp}.nobukti`,
          `${temp}.tglbukti`,
          `${temp}.keterangan as keterangan`,
          `${temp}.coa as coadetail`,
          `${temp}.sisa`,
          `${temp}.bayar as nominal`,
        )
        .from(trx.raw(`${temp} with (readuncommitted)`))
        .where(function () {
          this.whereRaw(`${temp}.sisa != 0`).orWhereRaw(`${temp}.sisa is null`);
        });

      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw new Error('Failed to fetch data');
    }
  }

  async createTempPengembalian(id: any, dari: any, sampai: any, trx: any) {
    try {
      const tglDariFormatted = formatDateToSQL(dari);
      const tglSampaiFormatted = formatDateToSQL(sampai);
      const temp = '##temp_' + Math.random().toString(36).substring(2, 8);

      // Create temp table for 'pengembalian'
      await trx.schema.createTable(temp, (t) => {
        t.string('nobukti');
        t.date('tglbukti');
        t.bigInteger('sisa').nullable();
        t.text('keterangan').nullable();
      });

      // Insert data into temp table for 'pengembalian'
      await trx(temp).insert(
        trx
          .select(
            'kd.nobukti',
            trx.raw('CAST(kg.tglbukti AS DATE) AS tglbukti'),
            trx.raw(`
              (SELECT (sum(kd.nominal) - COALESCE(SUM(pgd.nominal), 0)) 
               FROM pengembaliankasgantungdetail as pgd 
               WHERE pgd.kasgantung_nobukti = kd.nobukti) AS sisa, 
              MAX(kd.keterangan)
            `),
          )
          .from('kasgantungdetail as kd')
          .leftJoin('kasgantungheader as kg', 'kg.nobukti', 'kd.nobukti')
          .whereRaw(
            'kg.nobukti not in (select kasgantung_nobukti from pengembaliankasgantungdetail where pengembaliankasgantung_id=?)',
            [id],
          )
          .whereBetween('kg.tglbukti', [tglDariFormatted, tglSampaiFormatted])
          .groupBy('kd.nobukti', 'kg.tglbukti'),
      );
      return temp;
    } catch (error) {
      console.error('Error creating tempPengembalianKasGantung:', error);
      throw new Error('Failed to create tempPengembalianKasGantung');
    }
  }
  async createTempPengembalianKasGantung(
    id: any,
    dari: any,
    sampai: any,
    trx: any,
  ) {
    try {
      const tglDariFormatted = formatDateToSQL(dari);
      const tglSampaiFormatted = formatDateToSQL(sampai);
      const temp = '##temp_' + Math.random().toString(36).substring(2, 8);

      // Create temp table for 'pengembalian2'
      await trx.schema.createTable(temp, (t) => {
        t.bigInteger('pengembaliankasgantungheader_id').nullable();
        t.string('nobukti');
        t.date('tglbukti');
        t.bigInteger('bayar').nullable();
        t.string('keterangan').nullable();
        t.string('coa').nullable();
        t.bigInteger('sisa').nullable();
      });

      // Insert data into temp table for 'pengembalian2'
      await trx(temp).insert(
        trx
          .select(
            'pgd.pengembaliankasgantung_id as pengembaliankasgantungheader_id',
            'kd.nobukti',
            trx.raw('CAST(kg.tglbukti AS DATE) AS tglbukti'),
            trx.raw(`
              pgd.nominal as bayar,
              pgd.keterangan as keterangan,
              pgh.coakasmasuk as coa,
              (SELECT (sum(kd.nominal) - COALESCE(SUM(pgd.nominal), 0)) 
               FROM pengembaliankasgantungdetail as pgd 
               WHERE pgd.kasgantung_nobukti = kd.nobukti) AS sisa
            `),
          )
          .from('kasgantungdetail as kd')
          .leftJoin('kasgantungheader as kg', 'kg.id', 'kd.kasgantung_id')
          .leftJoin(
            'pengembaliankasgantungdetail as pgd',
            'pgd.kasgantung_nobukti',
            'kd.nobukti',
          )
          .leftJoin(
            'pengembaliankasgantungheader as pgh',
            'pgh.id',
            'pgd.pengembaliankasgantung_id',
          )
          .whereBetween('kg.tglbukti', [tglDariFormatted, tglSampaiFormatted])
          .where('pgd.pengembaliankasgantung_id', id)
          .groupBy(
            'pgd.pengembaliankasgantung_id',
            'kd.nobukti',
            'kg.tglbukti',
            'pgd.nominal',
            'pgd.keterangan',
            'pgh.coakasmasuk',
          ),
      );

      return temp;
    } catch (error) {
      console.error('Error creating tempPengembalian:', error);
      throw new Error('Failed to create tempPengembalian');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} kasgantungheader`;
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
        if (details.length > 0) {
          await this.kasgantungdetailService.create(details, id, trx);
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
          postingdari: `ADD KAS GANTUNG HEADER`,
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
        'kasgantungdetail',
        'kasgantung_id',
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE KAS GANTUNG DETAIL',
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
          'pengembaliankasgantungdetail',
          'kasgantung_nobukti',
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
}
