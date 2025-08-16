import { Injectable } from '@nestjs/common';
import { CreateEmklDto } from './dto/create-emkl.dto';
import { UpdateEmklDto } from './dto/update-emkl.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';

@Injectable()
export class EmklService {
  private readonly tableName = 'emkl';
  create(createEmklDto: CreateEmklDto) {
    return 'This action adds a new emkl';
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
        'b.statusrelasi',
        'b.relasi_id',
        'b.nama',
      ]);

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
      console.error('Error fetching bank data:', error);
      throw new Error('Failed to fetch bank data');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} emkl`;
  }

  update(id: number, updateEmklDto: UpdateEmklDto) {
    return `This action updates a #${id} emkl`;
  }

  remove(id: number) {
    return `This action removes a #${id} emkl`;
  }
}
