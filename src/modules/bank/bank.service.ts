import { Inject, Injectable } from '@nestjs/common';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RunningNumberService } from '../running-number/running-number.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { UtilsService } from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class BankService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
  ) {}
  private readonly tableName = 'bank';
  create(createBankDto: CreateBankDto) {
    return 'This action adds a new bank';
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

      // lookup mode: jika total > 500, kirim json saja
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

      // build query
      const query = trx(`${this.tableName} as b`).select([
        'b.id',
        'b.nama',
        'b.keterangan',
        'b.coa',
        'b.coagantung',
        'b.statusbank',
        'b.statusaktif',
        'b.statusdefault',
        'b.formatpenerimaan',
        'b.formatpengeluaran',
        'b.formatpenerimaangantung',
        'b.formatpengeluarangantung',
        'b.formatpencairan',
        'b.formatrekappenerimaan',
        'b.formatrekappengeluaran',
        'b.info',
        'b.modifiedby',
        'b.editing_by',
        trx.raw("FORMAT(b.updated_at, 'dd-MM-yyyy HH:mm:ss') as editing_at"),
        trx.raw("FORMAT(b.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
        trx.raw("FORMAT(b.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
      ]);

      // pencarian teks penuh (search)
      if (search) {
        const val = String(search).replace(/\[/g, '[[]');
        query.where((builder) =>
          builder
            .orWhere('b.nama', 'like', `%${val}%`)
            .orWhere('b.kode_bank', 'like', `%${val}%`)
            .orWhere('b.alamat', 'like', `%${val}%`)
            .orWhere('b.nomor_telepon', 'like', `%${val}%`)
            .orWhere('b.email', 'like', `%${val}%`),
        );
      }

      // filter berdasarkan key yang valid
      if (filters) {
        for (const [key, rawValue] of Object.entries(filters)) {
          if (!rawValue) continue;
          const val = String(rawValue).replace(/\[/g, '[[]');
          if (key === 'created_at' || key === 'updated_at') {
            query.andWhereRaw("FORMAT(b.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
              key,
              `%${val}%`,
            ]);
          } else if (
            ['nama', 'kode_bank', 'alamat', 'nomor_telepon', 'email'].includes(
              key,
            )
          ) {
            query.andWhere(`b.${key}`, 'like', `%${val}%`);
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
      console.error('Error fetching bank data:', error);
      throw new Error('Failed to fetch bank data');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} bank`;
  }

  update(id: number, updateBankDto: UpdateBankDto) {
    return `This action updates a #${id} bank`;
  }

  remove(id: number) {
    return `This action removes a #${id} bank`;
  }
}
