import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
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
  async create(CreateAlatbayarDto: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        nama,
        keterangan,
        statuslangsungcair,
        statusdefault,
        statusbank,
        statusaktif,
        modifiedby,
        created_at,
        updated_at,
        info,
      } = CreateAlatbayarDto;
      const insertData = {
        nama: nama ? nama.toUpperCase() : null,
        keterangan: keterangan ? keterangan.toUpperCase() : null,
        statuslangsungcair: statuslangsungcair,
        statusdefault: statusdefault,
        statusbank: statusbank,
        statusaktif: statusaktif,
        modifiedby: modifiedby,
        created_at: created_at || this.utilsService.getTime(),
        updated_at: updated_at || this.utilsService.getTime(),
      };
      // Insert the new item
      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');
      const newItem = insertedItems[0]; // Get the inserted item
      const { data, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );
      let itemIndex = data.findIndex((item) => item.id === newItem.id);
      if (itemIndex === -1) {
        itemIndex = 0;
      }
      // Optionally, you can find the page number or other info if needed
      const pageNumber = pagination?.currentPage;
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(newItem),
      );
      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD ALAT-BAYAR',
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
      throw new Error(`Error creating alat bayar: ${error.message}`);
    }
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
      const query = trx(`${this.tableName} as ab`)
        .select([
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
          'p1.text as statuslangsungcair_text',
          'p2.text as statusdefault_text',
          'p3.text as statusbank_text',
          'p.text',
          'p.memo',
        ])
        .leftJoin('parameter as p1', 'ab.statuslangsungcair', 'p1.id')
        .leftJoin('parameter as p2', 'ab.statusdefault', 'p2.id')
        .leftJoin('parameter as p3', 'ab.statusbank', 'p3.id')
        .leftJoin('parameter as p', 'ab.statusaktif', 'p.id');

      // full-text search pada kolom teks
      if (search) {
        const val = String(search).replace(/\[/g, '[[]');
        query.where((builder) =>
          builder
            .orWhere('ab.nama', 'like', `%${val}%`)
            .orWhere('ab.keterangan', 'like', `%${val}%`)
            .orWhere('p1.text', 'like', `%${val}%`)
            .orWhere('p2.text', 'like', `%${val}%`)
            .orWhere('p3.text', 'like', `%${val}%`)
            .orWhere('p.text', 'like', `%${val}%`)
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

  async update(id: number, data: any, trx: any) {
    try {
      const existingData = await trx(this.tableName).where('id', id).first();

      if (!existingData) {
        throw new Error('Alat Bayar not found');
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        statuslangsungcair_text,
        statusdefault_text,
        statusbank_text,
        text,
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

      const endIndex = pageNumber * itemsPerPage;
      const limitedItems = filteredData.slice(0, endIndex);
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'EDIT ALAT-BAYAR',
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
      console.error('Error updating Alat Bayar:', error);
      throw new Error('Failed to update Alat Bayar');
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
          postingdari: 'DELETE ALAT-BAYAR',
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
}
