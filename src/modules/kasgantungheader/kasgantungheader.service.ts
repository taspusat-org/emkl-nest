import { Inject, Injectable } from '@nestjs/common';
import { CreateKasgantungheaderDto } from './dto/create-kasgantungheader.dto';
import { UpdateKasgantungheaderDto } from './dto/update-kasgantungheader.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import { PengembaliankasgantungdetailService } from '../pengembaliankasgantungdetail/pengembaliankasgantungdetail.service';

@Injectable()
export class KasgantungheaderService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
  ) {}
  private readonly tableName = 'pengembaliankasgantungheader';
  create(createKasgantungheaderDto: CreateKasgantungheaderDto) {
    return 'This action adds a new kasgantungheader';
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
          'u.tglbukti', // tglbukti (date)
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
          trx.raw("FORMAT(u.editing_at, 'dd-MM-yyyy HH:mm:ss') as editing_at"), // editing_at (datetime)
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"), // created_at (datetime)
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"), // updated_at (datetime)
          trx.raw('SUM(kg.nominal) as sisa'), // Summary of nominal (money)
        ])
        .leftJoin('relasi as r', 'u.relasi_id', 'r.id')
        .leftJoin('bank as b', 'u.bank_id', 'b.id')
        .leftJoin('kasgantungdetail as kg', 'u.id', 'kg.kasgantung_id') // Join on kasgantung_id
        .leftJoin('alatbayar as ab', 'u.alatbayar_id', 'ab.id')
        .leftJoin('akunpusat as ap', 'u.coakasmasuk', 'ap.coa')
        .groupBy(
          'u.id',
          'u.nobukti',
          'u.tglbukti',
          'u.keterangan',
          'u.relasi_id',
          'u.bank_id',
          'u.pengeluaran_nobukti',
          'u.coakaskeluar',
          'u.dibayarke',
          'u.alatbayar_id',
          'u.nowarkat',
          'u.tgljatuhtempo',
          'u.gantungorderan_nobukti',
          'u.info',
          'u.modifiedby',
          'u.editing_by',
          'u.editing_at',
          'u.created_at',
          'u.updated_at',
        ); // Group by to aggregate nominal

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
            .orWhere('u.pengeluaran_nobukti', 'like', `%${sanitizedValue}%`)
            .orWhere('u.coakaskeluar', 'like', `%${sanitizedValue}%`)
            .orWhere('u.dibayarke', 'like', `%${sanitizedValue}%`)
            .orWhere('u.nowarkat', 'like', `%${sanitizedValue}%`)
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
