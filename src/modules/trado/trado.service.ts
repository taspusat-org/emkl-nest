import { Injectable } from '@nestjs/common';
import { UtilsService } from 'src/utils/utils.service';
import { CreateTradoDto } from './dto/create-trado.dto';
import { UpdateTradoDto } from './dto/update-trado.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';

@Injectable()
export class TradoService {
  private readonly tableName: string = 'trado';

  constructor(private readonly utilService: UtilsService) {}

  create(createTradoDto: CreateTradoDto) {
    return 'This action adds a new trado';
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
        const totalData = await trx(this.tableName)
          .count('id as total')
          .first();

        const resultTotalData = totalData?.total || 0;

        if (Number(resultTotalData) > 500) {
          return { data: { type: 'json' } };
        } else {
          limit = 0;
        }
      }

      const query = trx(`${this.tableName} as u`)
        .select([
          'u.id',
          'u.nama',
          'u.keterangan',
          'u.statusaktif',
          'u.modifiedby',
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'statusaktif.memo',
          'statusaktif.text as statusaktif_nama',
        ])
        .leftJoin(
          'parameter as statusaktif',
          'u.statusaktif',
          'statusaktif.id',
        );

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('u.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('u.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('u.modifiedby', 'like', `%${sanitizedValue}%`)
            .orWhereRaw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
              `%${sanitizedValue}%`,
            ])
            .orWhereRaw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
              `%${sanitizedValue}%`,
            ]);
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
            } else if (key === 'statusaktif_text') {
              query.andWhere(`statusaktif.id`, '=', sanitizedValue);
            } else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      if (sort?.sortBy && sort?.sortDirection) {
        query.orderBy(sort.sortBy, sort.sortDirection);
      }

      const result = await trx(this.tableName).count('id as total').first();
      const total = result?.total as number;
      const totalPages = Math.ceil(total / limit);
      const data = await query;
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
      console.error('Error to findAll Trado in Service', error);
      throw new Error(error);
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} trado`;
  }

  update(id: number, updateTradoDto: UpdateTradoDto) {
    return `This action updates a #${id} trado`;
  }

  remove(id: number) {
    return `This action removes a #${id} trado`;
  }
}
