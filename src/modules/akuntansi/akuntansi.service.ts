import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateAkuntansiDto } from './dto/create-akuntansi.dto';
import { UpdateAkuntansiDto } from './dto/update-akuntansi.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { Knex } from 'knex';
import { RedisService } from 'src/common/redis/redis.service';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { dbMssql } from 'src/common/utils/db';

@Injectable()
export class AkuntansiService {
  private readonly tableName: string = 'akuntansi';
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}
  async getById(id: number, trx: any) {
    try {
      const result = await trx(this.tableName).where('id', id).first();
      if (!result) {
        throw new Error('Data not found');
      }
      return result;
    } catch (error) {
      console.error('Error fetching data by id:', error);
      throw new Error('Failed to fetch data by id');
    }
  }
  async create(data: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        ...insertData
      } = data;
      insertData.updated_at = this.utilsService.getTime();
      insertData.created_at = this.utilsService.getTime();
      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });
      console.log('Insert Data:', insertData);

      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      const newItem = insertedItems[0];

      const query = trx(`${this.tableName} as u`)
        .select([
          'u.id as id',
          'u.nama',
          'u.keterangan',
          'u.statusaktif',
          'u.modifiedby',
          trx.raw(
            "ISNULL(FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss'), ' ') as created_at",
          ),
          trx.raw(
            "ISNULL(FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss'), ' ') as updated_at",
          ),
          'p.memo',
          'p.text',
        ])
        .leftJoin('parameter as p', 'u.statusaktif', 'p.id')
        .orderBy(sortBy ? `u.${sortBy}` : 'u.id', sortDirection || 'desc')
        .where('u.id', '<=', newItem.id); // Filter berdasarkan ID yang lebih kecil atau sama dengan newItem.id

      if (search) {
        query.where((builder) => {
          builder
            .orWhere('u.nama', 'like', `%${search}%`)
            .orWhere('u.keterangan', 'like', `%${search}%`)

            .orWhere('p.memo', 'like', `%${search}%`)

            .orWhere('p.text', 'like', `%${search}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value) {
            if (key === 'created_at' || key === 'updated_at') {
              query.andWhereRaw(
                "ISNULL(FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss'), ' ') LIKE ?",
                [key, `%${value}%`],
              );
            } else if (key === 'text' || key === 'memo') {
              query.andWhere(`p.${key}`, '=', value);
            } else {
              query.andWhere(`u.${key}`, 'like', `%${value}%`);
            }
          }
        }
      }

      // Ambil hasil query yang terfilter
      const filteredItems = await query;

      // Cari index item baru di hasil yang sudah difilter
      const itemIndex = filteredItems.findIndex(
        (item) => item.id === newItem.id,
      );

      if (itemIndex === -1) {
        throw new Error('Item baru tidak ditemukan di hasil pencarian');
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
          postingdari: 'ADD ERROR',
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
      throw new Error(`Error creating menu: ${error.message}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort }: FindAllParams,
    trx: any,
  ) {
    try {
      let { page, limit } = pagination;
      page = page ?? 1;
      limit = limit ?? 0;
      const offset = (page - 1) * limit;

      const query = trx(`${this.tableName} as u`)
        .select([
          'u.id as id',
          'u.nama',
          'u.keterangan',
          'u.statusaktif',
          'u.modifiedby',
          trx.raw(
            "ISNULL(FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss'), ' ') as created_at",
          ),
          trx.raw(
            "ISNULL(FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss'), ' ') as updated_at",
          ),
          'p.memo',
          'p.text',
        ])
        .leftJoin('parameter as p', 'u.statusaktif', 'p.id');

      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('u.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('u.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('p.memo', 'like', `%${sanitizedValue}%`)
            .orWhere('p.text', 'like', `%${sanitizedValue}%`);
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
            } else if (key === 'text' || key === 'memo') {
              query.andWhere(`p.${key}`, '=', sanitizedValue);
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
    return `This action returns a #${id} akuntansi`;
  }

  async update(id: number, data: any, trx: any) {
    try {
      const existingData = await trx(this.tableName).where('id', id).first();
      if (!existingData) {
        throw new Error('Akuntansi not found');
      }
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        isLookUp,
        ...insertData
      } = data;
      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });
      const hasChanges = this.utilsService.hasChanges(insertData, existingData);
      if (hasChanges) {
        insertData.updated_at = this.utilsService.getTime();
        await trx(this.tableName).where('id', id).update(insertData);
      }
      const { data: filteredData, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );
      // Cari index item yang baru saja diupdate
      const itemIndex = filteredData.findIndex(
        (item) => Number(item.id) === id,
      );
      if (itemIndex === -1) {
        throw new Error('Updated item not found in all items');
      }
      const itemsPerPage = limit || 10; // Default 10 items per page, atau yang dikirimkan dari frontend
      const pageNumber = Math.floor(itemIndex / itemsPerPage) + 1;
      // Ambil data hingga halaman yang mencakup item yang baru diperbarui
      const endIndex = pageNumber * itemsPerPage;
      const limitedItems = filteredData.slice(0, endIndex);
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );
      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'EDIT MENU',
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
      console.error('Error updating parameter:', error);
      throw new Error('Failed to update parameter');
    }
  }

  async delete(id: number, trx: any) {
    try {
      const deletedData = await this.utilsService.lockAndDestroy(
        id,
        this.tableName,
        'id',
        trx,
      );
      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE ERROR',
          idtrans: deletedData.id,
          nobuktitrans: deletedData.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedData),
          modifiedby: deletedData.modifiedby,
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

  remove(id: number) {
    return `This action removes a #${id} akuntansi`;
  }
}
