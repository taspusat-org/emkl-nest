import { Injectable } from '@nestjs/common';
import { CreateJenisprosesfeeDto } from './dto/create-jenisprosesfee.dto';
import { UpdateJenisprosesfeeDto } from './dto/update-jenisprosesfee.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';

@Injectable()
export class JenisprosesfeeService {
  private readonly tableName = 'jenisprosesfee';

  // constructor(
  //   private readonly log
  // ) {}

  create(createJenisprosesfeeDto: CreateJenisprosesfeeDto) {
    return 'This action adds a new jenisprosesfee';
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
        const jenisProsesFeeResult = await trx(this.tableName)
          .count('id as total')
          .first();

        const totalData = jenisProsesFeeResult?.total || 0;
        if (Number(totalData) > 500) {
          return { data: { type: 'json' } };
        } else {
          limit = 0;
        }
      }

      const query = trx(`${this.tableName} as p`)
        .select([
          'p.id',
          'p.nama',
          'p.keterangan',
          'p.statusaktif',
          'p.modifiedby',
          trx.raw("FORMAT(p.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(p.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'statusaktif.memo as statusaktif_memo',
          'statusaktif.text as statusaktif_text',
        ])
        .leftJoin(
          'parameter as statusaktif',
          'p.statusaktif',
          'statusaktif.id',
        );

      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('p.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('p.keterangan', 'like', `%${sanitizedValue}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'created_at' || key === 'updated_at') {
              query.andWhereRaw("FORMAT(p.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
                key,
                `%${sanitizedValue}%`,
              ]);
            } else if (key === 'statusaktif_text') {
              query.andWhere(`statusaktif.text`, '=', sanitizedValue);
            } else {
              query.andWhere(`p.${key}`, 'like', `%${sanitizedValue}%`);
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
      console.error('Error fetching data jenis proses fee in service:', error);
      throw new Error('Failed to fetch data jenis proses fee in service');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} jenisprosesfee`;
  }

  update(id: number, updateJenisprosesfeeDto: UpdateJenisprosesfeeDto) {
    return `This action updates a #${id} jenisprosesfee`;
  }

  remove(id: number) {
    return `This action removes a #${id} jenisprosesfee`;
  }
}
