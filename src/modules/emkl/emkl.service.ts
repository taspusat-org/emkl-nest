import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateEmklDto } from './dto/create-emkl.dto';
import { UpdateEmklDto } from './dto/update-emkl.dto';
import { RedisService } from 'src/common/redis/redis.service';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RelasiService } from '../relasi/relasi.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';

@Injectable()
export class EmklService {
  private readonly tableName = 'emkl';
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly relasiService: RelasiService,
  ) {}
  async create(createEmklDto: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        statustrado_text,
        statusaktif_text,
        ...insertData
      } = createEmklDto;
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

      const statusRelasi = await trx('parameter')
        .select('*')
        .where('grp', 'STATUS RELASI')
        .where('text', 'EMKL')
        .first();

      const relasi = {
        nama: insertData.nama,
        statusrelasi: statusRelasi.id,
        coagiro: insertData.coagiro,
        coapiutang: insertData.coapiutang,
        coahutang: insertData.coahutang,
        alamat: insertData.alamat,
        npwp: insertData.npwp,
        namapajak: insertData.namapajak,
        alamatpajak: insertData.alamatpajak,
        statusaktif: insertData.statusaktif,
        modifiedby: insertData.modifiedby,
      };
      const dataRelasi = await this.relasiService.create(relasi, trx);

      const newItem = insertedItems[0];
      await trx(this.tableName)
        .update({
          relasi_id: Number(dataRelasi.id),
        })
        .where('id', newItem.id)
        .returning('*');

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
          postingdari: 'ADD EMKL',
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
      throw new Error(`Error creating EMKL: ${error.message}`);
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
        const emklCountResult = await trx(this.tableName)
          .count('id as total')
          .first();

        const emklCount = emklCountResult?.total || 0;
        if (Number(emklCount) > 500) {
          return { data: { type: 'json' } };
        } else {
          limit = 0;
        }
      }

      const query = trx(`${this.tableName} as emkl`)
        .select([
          'emkl.id as id',
          'emkl.nama',
          'emkl.contactperson',
          'emkl.alamat',
          'emkl.coagiro',
          'emkl.coapiutang',
          'emkl.coahutang',
          'emkl.kota',
          'emkl.kodepos',
          'emkl.notelp',
          'emkl.email',
          'emkl.fax',
          'emkl.alamatweb',
          'emkl.top',
          'emkl.npwp',
          'emkl.namapajak',
          'emkl.alamatpajak',
          'emkl.statustrado',
          'emkl.statusaktif',
          'emkl.modifiedby',
          trx.raw(
            "FORMAT(emkl.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at",
          ),
          trx.raw(
            "FORMAT(emkl.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at",
          ),
          'statusaktif.memo as statusaktif_memo',
          'statusaktif.text as statusaktif_text',
          'statustrado.memo as statustrado_memo',
          'statustrado.text as statustrado_text',
          'coagiro.keterangancoa as coagiro_ket',
          'coapiutang.keterangancoa as coapiutang_ket',
          'coahutang.keterangancoa as coahutang_ket',
        ])
        .leftJoin('akunpusat as coagiro', 'emkl.coagiro', 'coagiro.coa')
        .leftJoin(
          'akunpusat as coapiutang',
          'emkl.coapiutang',
          'coapiutang.coa',
        )
        .leftJoin('akunpusat as coahutang', 'emkl.coahutang', 'coahutang.coa')
        .leftJoin(
          'parameter as statustrado',
          'emkl.statustrado',
          'statustrado.id',
        )
        .leftJoin(
          'parameter as statusaktif',
          'emkl.statusaktif',
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
            .orWhere('emkl.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('emkl.contactperson', 'like', `%${sanitizedValue}%`)
            .orWhere('coagiro.keterangancoa', 'like', `%${sanitizedValue}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'created_at' || key === 'updated_at') {
              query.andWhereRaw(
                "FORMAT(emkl.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?",
                [key, `%${sanitizedValue}%`],
              );
            } else if (key === 'statusaktif_text') {
              query.andWhere(`statusaktif.text`, '=', sanitizedValue);
            } else if (key === 'statustrado_text') {
              query.andWhere(`statustrado.text`, '=', sanitizedValue);
            } else if (key === 'coagiro_ket') {
              query.andWhere(
                `coagiro.keterangancoa`,
                'like',
                `%${sanitizedValue}%`,
              );
            } else if (key === 'coahutang_ket') {
              query.andWhere(
                `coahutang.keterangancoa`,
                'like',
                `%${sanitizedValue}%`,
              );
            } else if (key === 'coapiutang_ket') {
              query.andWhere(
                `coapiutang.keterangancoa`,
                'like',
                `%${sanitizedValue}%`,
              );
            } else {
              query.andWhere(`emkl.${key}`, 'like', `%${sanitizedValue}%`);
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
        throw new Error('Emkl not found');
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        statustrado_text,
        statusaktif_text,
        coagiro_ket,
        coahutang_ket,
        coapiutang_ket,
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
      const statusRelasi = await trx('parameter')
        .select('*')
        .where('grp', 'STATUS RELASI')
        .where('text', 'EMKL')
        .first();
      const relasi = {
        nama: insertData.nama,
        statusrelasi: statusRelasi.id,
        coagiro: insertData.coagiro,
        coapiutang: insertData.coapiutang,
        coahutang: insertData.coahutang,
        alamat: insertData.alamat,
        npwp: insertData.npwp,
        namapajak: insertData.namapajak,
        alamatpajak: insertData.alamatpajak,
        statusaktif: insertData.statusaktif,
        modifiedby: insertData.modifiedby,
      };
      const dataRelasi = await this.relasiService.update(
        existingData.relasi_id,
        relasi,
        trx,
      );
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
          postingdari: 'EDIT EMKL',
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
      console.error('Error updating emkl:', error);
      throw new Error('Failed to update emkl');
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
          postingdari: 'DELETE EMKL',
          idtrans: deletedData.id,
          nobuktitrans: deletedData.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedData),
          modifiedby: modifiedby,
        },
        trx,
      );

      const dataRelasi = await this.relasiService.delete(
        deletedData.relasi_id,
        trx,
        modifiedby,
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
