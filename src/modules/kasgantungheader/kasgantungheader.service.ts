import { Inject, Injectable } from '@nestjs/common';
import { CreateKasgantungheaderDto } from './dto/create-kasgantungheader.dto';
import { UpdateKasgantungheaderDto } from './dto/update-kasgantungheader.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import { PengembaliankasgantungdetailService } from '../pengembaliankasgantungdetail/pengembaliankasgantungdetail.service';
import { KasgantungdetailService } from '../kasgantungdetail/kasgantungdetail.service';

@Injectable()
export class KasgantungheaderService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
    private readonly kasgantungdetailService: KasgantungdetailService,
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

      const parameter = await trx('parameter')
        .select('*')
        .where('grp', 'KAS GANTUNG')
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
          'b.nama_bank as bank_nama', // bank_nama (varchar(200))
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

  async getPengembalian(dari: any, sampai: any, trx: any) {
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
      const result = await trx
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
  findOne(id: number) {
    return `This action returns a #${id} kasgantungheader`;
  }

  update(id: number, updateKasgantungheaderDto: UpdateKasgantungheaderDto) {
    return `This action updates a #${id} kasgantungheader`;
  }

  remove(id: number) {
    return `This action removes a #${id} kasgantungheader`;
  }
}
