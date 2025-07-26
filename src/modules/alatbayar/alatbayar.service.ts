import { Inject, Injectable } from '@nestjs/common';
import { CreateAlatbayarDto } from './dto/create-alatbayar.dto';
import { UpdateAlatbayarDto } from './dto/update-alatbayar.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';

@Injectable()
export class AlatbayarService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
  ) {}
  private readonly tableName = 'alatbayar';
  create(createAlatbayarDto: CreateAlatbayarDto) {
    return 'This action adds a new alatbayar';
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      // set default pagination
      let { page, limit } = pagination;

      page = page ?? 1;
      limit = limit ?? 0;

      // lookup mode: jika total > 500, kembalikan json saja
      if (isLookUp) {
        const countResult = await trx(this.tableName)
          .count('id as total')
          .first();
        const totalCount = Number(countResult?.total) || 0;
        if (totalCount > 500) {
          return { data: { type: 'json' } };
        }
        limit = 0;
      }

      // bangun query dasar
      const query = trx(`${this.tableName} as ab`).select([
        'ab.id',
        'ab.nama',
        'ab.keterangan',
        'ab.statuslangsungcair',
        'ab.statusdefault',
        'ab.statusbank',
        'ab.statusaktif',
        'ab.info',
        'ab.modifiedby',
        'ab.editing_by',
        trx.raw("FORMAT(ab.editing_at, 'dd-MM-yyyy HH:mm:ss') as editing_at"),
        trx.raw(
          "FORMAT(ab.created_at,    'dd-MM-yyyy HH:mm:ss') as created_at",
        ),
        trx.raw(
          "FORMAT(ab.updated_at,    'dd-MM-yyyy HH:mm:ss') as updated_at",
        ),
      ]);

      // full-text search pada kolom teks
      if (search) {
        const val = String(search).replace(/\[/g, '[[]');
        query.where((builder) =>
          builder
            .orWhere('ab.nama', 'like', `%${val}%`)
            .orWhere('ab.keterangan', 'like', `%${val}%`)
            .orWhere('ab.info', 'like', `%${val}%`)
            .orWhere('ab.modifiedby', 'like', `%${val}%`)
            .orWhere('ab.editing_by', 'like', `%${val}%`),
        );
      }

      // filter per kolom
      if (filters) {
        for (const [key, rawValue] of Object.entries(filters)) {
          if (rawValue == null || rawValue === '') continue;
          const val = String(rawValue).replace(/\[/g, '[[]');

          // tanggal / timestamp
          if (['editing_at', 'created_at', 'updated_at'].includes(key)) {
            query.andWhereRaw("FORMAT(ab.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
              key,
              `%${val}%`,
            ]);
          }
          // kolom teks lainnya
          else if (
            ['nama', 'keterangan', 'info', 'modifiedby', 'editing_by'].includes(
              key,
            )
          ) {
            query.andWhere(`ab.${key}`, 'like', `%${val}%`);
          }
          // kolom numerik
          else if (
            [
              'statuslangsungcair',
              'statusdefault',
              'statusbank',
              'statusaktif',
            ].includes(key)
          ) {
            query.andWhere(`ab.${key}`, Number(val));
          }
        }
      }

      // pagination
      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      // sorting
      if (sort?.sortBy && sort?.sortDirection) {
        query.orderBy(sort.sortBy, sort.sortDirection);
      }

      // hitung total items untuk pagination
      const totalResult = await trx(this.tableName)
        .count('id as total')
        .first();
      const totalItems = Number(totalResult?.total) || 0;
      const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;

      // eksekusi query
      const data = await query;
      const responseType = totalItems > 500 ? 'json' : 'local';

      return {
        data,
        type: responseType,
        total: totalItems,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      console.error('Error fetching alatbayar data:', error);
      throw new Error('Failed to fetch alatbayar data');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} alatbayar`;
  }

  update(id: number, updateAlatbayarDto: UpdateAlatbayarDto) {
    return `This action updates a #${id} alatbayar`;
  }

  remove(id: number) {
    return `This action removes a #${id} alatbayar`;
  }
}
