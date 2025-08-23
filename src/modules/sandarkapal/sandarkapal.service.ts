import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateSandarkapalDto } from './dto/create-sandarkapal.dto';
import { UpdateSandarkapalDto } from './dto/update-sandarkapal.dto';
import { RedisService } from 'src/common/redis/redis.service';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { LocksService } from '../locks/locks.service';

@Injectable()
export class SandarkapalService {
  private readonly tableName = 'sandarkapal';
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly locksService: LocksService,
  ) {}

  async create(CreateSandarkapalDto: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        statusaktif_text,
        ...insertData
      } = CreateSandarkapalDto;
      insertData.updated_at = this.utilsService.getTime();
      insertData.created_at = this.utilsService.getTime();

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });

      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      const newItem = insertedItems[0];

      const { data, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false,
        },
        trx,
      );
      let itemIndex = data.findIndex((item) => item.id === newItem.id);
      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const pageNumber = pagination?.currentPage;

      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(data),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD SANDARKAPAL',
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
      throw new Error(`Error creating sandarkapal: ${error.message}`);
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
        const sandarkapalCountResult = await trx(this.tableName)
          .count('id as total')
          .first();

        const sandarkapalCount = sandarkapalCountResult?.total || 0;
        if (Number(sandarkapalCount) > 500) {
          return { data: { type: 'json' } };
        } else {
          limit = 0;
        }
      }

      const query = trx(`${this.tableName} as pel`)
        .select([
          'pel.id as id',
          'pel.nama',
          'pel.keterangan',
          'pel.statusaktif',
          'pel.modifiedby',
          trx.raw(
            "FORMAT(pel.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at",
          ),
          trx.raw(
            "FORMAT(pel.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at",
          ),
          'par.memo',
          'par.text as statusaktif_text',
        ])
        .leftJoin('parameter as par', 'pel.statusaktif', 'par.id');

      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('pel.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('pel.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('par.memo', 'like', `%${sanitizedValue}%`)
            .orWhere('par.text', 'like', `%${sanitizedValue}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'created_at' || key === 'updated_at') {
              query.andWhereRaw(
                "FORMAT(pel.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?",
                [key, `%${sanitizedValue}%`],
              );
            } else if (key === 'text' || key === 'memo') {
              query.andWhere(`par.${key}`, '=', sanitizedValue);
            } else {
              query.andWhere(`pel.${key}`, 'like', `%${sanitizedValue}%`);
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

  async update(id: number, data: any, trx: any) {
    try {
      const existingData = await trx(this.tableName).where('id', id).first();

      if (!existingData) {
        throw new Error('Sandar kapal not found');
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        statusaktif_text,
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
          postingdari: 'EDIT SANDARKAPAL',
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
      console.error('Error updating sandarkapal:', error);
      throw new Error('Failed to update sandarkapal');
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

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE SANDARKAPAL',
          idtrans: deletedData.id,
          nobuktitrans: deletedData.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedData),
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
        const validasi = {
          status: 'success',
          message: 'Data aman untuk dihapus.',
        };

        return validasi;
      }
    } catch (error) {
      console.error('Error di checkValidasi:', error);
      throw new InternalServerErrorException('Failed to check validation');
    }
  }
}
