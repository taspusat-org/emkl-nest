import { Inject, Injectable } from '@nestjs/common';
import { CreateRelasiDto } from './dto/create-relasi.dto';
import { UpdateRelasiDto } from './dto/update-relasi.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RunningNumberService } from '../running-number/running-number.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { UtilsService } from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';
@Injectable()
export class RelasiService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
  ) {}
  private readonly tableName = 'relasi';
  create(createRelasiDto: CreateRelasiDto) {
    return 'This action adds a new relasi';
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      // default pagination
      let { page, limit } = pagination;

      page = page ?? 1;
      limit = limit ?? 0;

      // lookup mode: jika total > 500, kembalikan JSON saja
      if (isLookUp) {
        const cnt = await trx(this.tableName).count('id as total').first();
        const totalCount = Number(cnt?.total) || 0;
        if (totalCount > 500) {
          return { data: { type: 'json' } };
        }
        limit = 0;
      }

      // build query
      const query = trx(`${this.tableName} as r`).select([
        'r.id',
        'r.statusrelasi',
        'r.nama',
        'r.coagiro',
        'r.coapiutang',
        'r.coahutang',
        'r.statustitip',
        'r.titipcabang_id',
        'r.alamat',
        'r.npwp',
        'r.namapajak',
        'r.alamatpajak',
        'r.statusaktif',
        'r.info',
        'r.modifiedby',
        'r.editing_by',
        trx.raw("FORMAT(r.editing_at, 'dd-MM-yyyy HH:mm:ss') as editing_at"),
        trx.raw("FORMAT(r.created_at,  'dd-MM-yyyy HH:mm:ss') as created_at"),
        trx.raw("FORMAT(r.updated_at,  'dd-MM-yyyy HH:mm:ss') as updated_at"),
      ]);

      // full-text search
      if (search) {
        const val = String(search).replace(/\[/g, '[[]');
        query.where((builder) =>
          builder
            .orWhere('r.nama', 'like', `%${val}%`)
            .orWhere('r.coagiro', 'like', `%${val}%`)
            .orWhere('r.coapiutang', 'like', `%${val}%`)
            .orWhere('r.coahutang', 'like', `%${val}%`)
            .orWhere('r.alamat', 'like', `%${val}%`)
            .orWhere('r.npwp', 'like', `%${val}%`)
            .orWhere('r.namapajak', 'like', `%${val}%`)
            .orWhere('r.alamatpajak', 'like', `%${val}%`)
            .orWhere('r.info', 'like', `%${val}%`)
            .orWhere('r.modifiedby', 'like', `%${val}%`)
            .orWhere('r.editing_by', 'like', `%${val}%`),
        );
      }

      // filters per kolom
      if (filters) {
        for (const [key, rawValue] of Object.entries(filters)) {
          if (rawValue == null || rawValue === '') continue;
          const val = String(rawValue).replace(/\[/g, '[[]');

          // timestamp fields
          if (['editing_at', 'created_at', 'updated_at'].includes(key)) {
            query.andWhereRaw("FORMAT(r.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
              key,
              `%${val}%`,
            ]);
          }
          // numeric fields
          else if (
            [
              'statusrelasi',
              'statustitip',
              'titipcabang_id',
              'statusaktif',
            ].includes(key)
          ) {
            query.andWhere(`r.${key}`, Number(val));
          }
          // text fields
          else if (
            [
              'nama',
              'coagiro',
              'coapiutang',
              'coahutang',
              'alamat',
              'npwp',
              'namapajak',
              'alamatpajak',
              'info',
              'modifiedby',
              'editing_by',
            ].includes(key)
          ) {
            query.andWhere(`r.${key}`, 'like', `%${val}%`);
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

      // hitung total untuk pagination
      const tot = await trx(this.tableName).count('id as total').first();
      const totalItems = Number(tot?.total) || 0;
      const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;

      // eksekusi dan kembalikan hasil
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
      console.error('Error fetching relasi data:', error);
      throw new Error('Failed to fetch relasi data');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} relasi`;
  }

  update(id: number, updateRelasiDto: UpdateRelasiDto) {
    return `This action updates a #${id} relasi`;
  }

  remove(id: number) {
    return `This action removes a #${id} relasi`;
  }
}
