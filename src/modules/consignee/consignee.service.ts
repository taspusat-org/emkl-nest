import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateConsigneeDto } from './dto/create-consignee.dto';
import { UpdateConsigneeDto } from './dto/update-consignee.dto';
import { formatDateToSQL } from 'src/utils/utils.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import { StatuspendukungService } from '../statuspendukung/statuspendukung.service';
import { RedisService } from '../../common/redis/redis.service';
import { ConsigneedetailService } from '../consigneedetail/consigneedetail.service';
import { ConsigneehargajualService } from '../consigneehargajual/consigneehargajual.service';

@Injectable()
export class ConsigneeService {
  private readonly tableName = 'consignee';
  constructor(
    private readonly utilsService: UtilsService,
    private readonly statuspendukungService: StatuspendukungService,
    private readonly logTrailService: LogtrailService,
    private readonly redisService: RedisService,
    private readonly consigneeDetailService: ConsigneedetailService,
    private readonly consigneeHargaJualService: ConsigneehargajualService,
  ) {}
  async create(data: any, trx: any) {
    try {
      Object.keys(data).forEach((key) => {
        if (typeof data[key] === 'string') {
          data[key] = data[key].toUpperCase();
        }
      });
      const payload = {
        shipper_id: data.shipper_id,
        namaconsignee: data.namaconsignee,
        tujuankapal_id: data.tujuankapal_id,
        info: data.info,
        modifiedby: data.modifiedby,
        created_at: this.utilsService.getTime(),
        updated_at: this.utilsService.getTime(),
      };
      const insertedItems = await trx(this.tableName)
        .insert(payload)
        .returning('*');

      if (data.details && data.details.length > 0) {
        const consigneeDetails = data.details.map((detail: any) => {
          return {
            id: 0,
            consignee_id: insertedItems[0].id,
            keterangan: detail.keterangan,
            modifiedby: payload.modifiedby,
          };
        });
        const consigneeHargaJual = data.hargajual.map((detail: any) => {
          return {
            id: 0,
            consignee_id: insertedItems[0].id,
            container_id: detail.container_id,
            nominal: detail.nominal,
            modifiedby: payload.modifiedby,
          };
        });
        await this.consigneeDetailService.create(
          consigneeDetails,
          insertedItems[0].id,
          trx,
        );
        await this.consigneeHargaJualService.create(
          consigneeHargaJual,
          insertedItems[0].id,
          trx,
        );
      }
      const newItem = insertedItems[0];
      const { data: filteredItems } = await this.findAll(
        {
          search: data.search,
          filters: data.filters,
          pagination: { page: data.page, limit: data.limit },
          sort: { sortBy: data.sortBy, sortDirection: data.sortDirection },
          isLookUp: false,
        },
        trx,
      );

      let itemIndex = filteredItems.findIndex(
        (item) => Number(item.id) === Number(newItem.id),
      );

      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const pageNumber = Math.floor(itemIndex / data.limit) + 1;
      const endIndex = pageNumber * data.limit;

      const limitedItems = filteredItems.slice(0, endIndex);

      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.statuspendukungService.create(
        this.tableName,
        newItem.id,
        data.modifiedby,
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: `ADD PACKING LIST HEADER`,
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
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal server error',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
        const consigneeCountResult = await trx(this.tableName)
          .count('id as total')
          .first();

        const consigneeCount = consigneeCountResult?.total || 0;

        if (Number(consigneeCount) > 500) {
          return { data: { type: 'json' } };
        } else {
          limit = 0;
        }
      }
      const query = trx(`${this.tableName} as consignee`)
        .select([
          'consignee.id as id',
          'consignee.shipper_id', // nobukti (nvarchar(100))
          'consignee.namaconsignee', // nobukti (nvarchar(100))
          'consignee.tujuankapal_id', // nobukti (nvarchar(100))
          's.nama as shipper_nama',
          'tk.nama as tujuankapal_nama',
          'consignee.info', // info (nvarchar(max))
          'consignee.modifiedby', // modifiedby (varchar(200))
          trx.raw(
            "FORMAT(consignee.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at",
          ), // created_at (datetime)
          trx.raw(
            "FORMAT(consignee.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at",
          ), // updated_at (datetime)
        ])
        .leftJoin('shipper as s', 'consignee.shipper_id', 's.id')
        .leftJoin('tujuankapal as tk', 'consignee.tujuankapal_id', 'tk.id');

      const excludeSearchKeys = ['tglDari', 'tglSampai'];
      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }
      const searchFields = Object.keys(filters || {}).filter(
        (k) => !excludeSearchKeys.includes(k),
      );
      if (search) {
        const sanitized = String(search).replace(/\[/g, '[[]').trim();

        query.where((qb) => {
          searchFields.forEach((field) => {
            qb.orWhere(`consignee.${field}`, 'like', `%${sanitized}%`);
          });
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');

          if (value) {
            if (key === 'created_at' || key === 'updated_at') {
              query.andWhereRaw(
                "FORMAT(consignee.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?",
                [key, `%${sanitizedValue}%`],
              );
            } else if (key === 'shipper_nama') {
              query.andWhere('s.nama', 'like', `%${sanitizedValue}%`);
            } else if (key === 'tujuankapal_nama') {
              query.andWhere('tk.nama', 'like', `%${sanitizedValue}%`);
            } else {
              query.andWhere(`consignee.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      const result = await trx(this.tableName)
        .count('consignee.id as total')
        .first();
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
    return `This action returns a #${id} consignee`;
  }

  async update(id: number, data: any, trx: any) {
    try {
      Object.keys(data).forEach((key) => {
        if (typeof data[key] === 'string') {
          data[key] = data[key].toUpperCase();
        }
      });
      const payload = {
        shipper_id: data.shipper_id,
        namaconsignee: data.namaconsignee,
        tujuankapal_id: data.tujuankapal_id,
        info: data.info,
        modifiedby: data.modifiedby,
        created_at: this.utilsService.getTime(),
        updated_at: this.utilsService.getTime(),
      };
      const existingData = await trx(this.tableName).where('id', id).first();
      const hasChanges = this.utilsService.hasChanges(payload, existingData);

      if (hasChanges) {
        payload.updated_at = this.utilsService.getTime();

        await trx(this.tableName).where('id', id).update(payload);
      }

      if (data.details && data.details.length > 0) {
        const consigneeDetails = data.details.map((detail: any) => {
          return {
            id: detail.id ?? 0,
            consignee_id: id,
            keterangan: detail.keterangan,
            modifiedby: payload.modifiedby,
          };
        });
        const consigneeHargaJual = data.hargajual.map((detail: any) => {
          return {
            id: detail.id ?? 0,
            consignee_id: id,
            container_id: detail.container_id,
            nominal: detail.nominal,
            modifiedby: payload.modifiedby,
          };
        });
        await this.consigneeDetailService.create(consigneeDetails, id, trx);
        await this.consigneeHargaJualService.create(
          consigneeHargaJual,
          id,
          trx,
        );
      }
      const { data: filteredItems } = await this.findAll(
        {
          search: data.search,
          filters: data.filters,
          pagination: { page: data.page, limit: data.limit },
          sort: { sortBy: data.sortBy, sortDirection: data.sortDirection },
          isLookUp: false,
        },
        trx,
      );

      let itemIndex = filteredItems.findIndex(
        (item) => Number(item.id) === Number(id),
      );

      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const pageNumber = Math.floor(itemIndex / data.limit) + 1;
      const endIndex = pageNumber * data.limit;

      const limitedItems = filteredItems.slice(0, endIndex);

      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.statuspendukungService.create(
        this.tableName,
        id,
        data.modifiedby,
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: `ADD PACKING LIST HEADER`,
          idtrans: id,
          nobuktitrans: id,
          aksi: 'ADD',
          datajson: JSON.stringify(payload),
          modifiedby: payload.modifiedby,
        },
        trx,
      );

      return {
        pageNumber,
        itemIndex,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal server error',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
      await this.consigneeDetailService.delete(id, trx, modifiedby);
      await this.consigneeHargaJualService.delete(id, trx, modifiedby);
      await this.statuspendukungService.remove(id, modifiedby, trx);

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE CONSIGNEE',
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
      console.log('Error deleting data:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete data');
    }
  }
}
