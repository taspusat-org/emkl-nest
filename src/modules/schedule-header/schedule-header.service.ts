import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateScheduleHeaderDto } from './dto/create-schedule-header.dto';
import { UpdateScheduleHeaderDto } from './dto/update-schedule-header.dto';
import { ScheduleDetailService } from '../schedule-detail/schedule-detail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { GlobalService } from '../global/global.service';
import { RedisService } from 'src/common/redis/redis.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';

@Injectable()
export class ScheduleHeaderService {
  private readonly tableName = 'scheduleheader';

  constructor(
    @Inject('REDIS_CLIENT') 
    private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly globalService: GlobalService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
    private readonly scheduleDetailService: ScheduleDetailService,
  ) {}

  async create(data: any, trx: any) {
    try {
      data.tglbukti = formatDateToSQL(String(data?.tglbukti))

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        details,
        ...insertedData
      } = data;
      insertedData.updated_at = this.utilsService.getTime();
      insertedData.created_at = this.utilsService.getTime();
      // console.log('masuk sinii?', 'insertedData', insertedData, 'details', details);

      Object.keys(insertedData).forEach((key) => {
        if (typeof insertedData[key] === 'string') {
          insertedData[key] = insertedData[key].toUpperCase();
        }
      })

      const parameter = await trx('parameter').select('*').where('grp', 'SCHEDULE').first();
      const nomorBukti = await this.runningNumberService.generateRunningNumber(trx, parameter.grp, parameter.subgrp, this.tableName, insertedData.tglbukti)
      insertedData.nobukti = nomorBukti;

      const insertedItems = await trx(this.tableName).insert(insertedData).returning('*');

      if (details.length > 0) { // insert nobukti into each item of detail
        const detailsWithNobukti = details.map((detail: any) => ({
          ...detail,
          nobukti: nomorBukti,
          modifiedby: insertedData.modifiedby
        }))

        await this.scheduleDetailService.create(detailsWithNobukti, insertedItems[0].id, trx)
      }

      const newItem = insertedItems[0];

      const { data: filteredItems } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false,
        },
        trx
      )      

      let dataIndex = filteredItems.findIndex((item) => (item.id) === newItem.id)
      // console.log('newItem', newItem.id, 'filteredItems', filteredItems,);
      
      if (dataIndex === -1) {
        dataIndex = 0
      }
      const pageNumber = Math.floor(dataIndex / limit) + 1;
      const endIndex = pageNumber * limit;
      const limitedItems = filteredItems.slice(0, endIndex);  // Ambil data hingga halaman yang mencakup item baru
      // console.log('herer', dataIndex, 'pageNumber', pageNumber, 'endIndex', endIndex, 'limitedItems', limitedItems);

      await this.redisService.set(`${this.tableName}-allItems`, JSON.stringify(limitedItems));
      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: `ADD SCHEDULE HEADER`,
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
        dataIndex,
      };
    } catch (error) {
      throw new Error(`Error: ${error.message}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp } : FindAllParams,
    trx: any
  ) {
    try {
      let { page, limit } = pagination;
      page = page ?? 1;
      limit = limit ?? 0;      

      if (isLookUp) {
        const scheduleheaderCount = await trx(this.tableName)
          .count('id as total')
          .first();

        const scheduleCountResult = scheduleheaderCount?.total || 0;

        if (Number(scheduleCountResult) > 500) {
          return { data: { type: 'json' } };
        } else {
          limit = 0;
        }
      }

      const query = trx(`${this.tableName} as u`)
      .select([
        'u.id as id',
        'u.nobukti',
        trx.raw("FORMAT(u.tglbukti, 'dd-MM-yyyy') as tglbukti"),
        'u.keterangan',
        'u.modifiedby',
        trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"), 
        trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"), 
      ])

      if (filters?.tglDari && filters?.tglSampai) {
        const tglDariFormatted = formatDateToSQL(String(filters?.tglDari)); 
        const tglSampaiFormatted = formatDateToSQL(String(filters?.tglSampai));
        query.whereBetween('u.tglbukti', [tglDariFormatted, tglSampaiFormatted]);
      }
      const excludeSearchKeys = ['tglDari', 'tglSampai'];

      const searchFields = Object.keys(filters || {}).filter(
        // (k) => !excludeSearchKeys.includes(k) && filters![k],
        (k) => !excludeSearchKeys.includes(k),
      );

      if (search) {
        const sanitized = String(search).replace(/\[/g, '[[]').trim();

        query.where((builder) => {
          searchFields.forEach((field) => {
            // if (field == 'created_at' || field == 'updated_at') {
            //   query.orWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [field, `%${sanitized}%`]);
            // } else { 
              builder.orWhere(`u.${field}`, 'like', `%${sanitized}%`);
            // }
          });
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');

          if (key === 'tglDari' || key === 'tglSampai') {
            continue; // Lewati filter jika key adalah 'tglDari' atau 'tglSampai'
          }

          if (value) {
            if (key === 'created_at' || key === 'updated_at' || key === 'tglbukti') {
              query.andWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [key, `%${sanitizedValue}%`]);
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

      const result = await trx(this.tableName).count('id as total').first();
      const total = result?.total as number;
      const totalPages = Math.ceil(total / limit)
      // console.log('result',result, 'total', total, 'totalPages',totalPages, 'page limit di findall');

      if (sort?.sortBy && sort.sortDirection) {
        query.orderBy(sort.sortBy, sort.sortDirection)
      }

      const data = await query;
      const responseType = Number(total) > 500 ? 'json' : 'local';
      // console.log('data', data);

      return {
        data: data,
        type: responseType,
        total,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: total,
          itemPerPage: limit
        }
      }
    } catch (error) {
      console.error('Error fetching data schedule header in service:', error);
      throw new Error('Failed to fetch data schedule header in service');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} scheduleHeader`;
  }

  async update(id: any, data: any, trx: any) {
    try {
      data.tglbukti = formatDateToSQL(String(data?.tglbukti));
      
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        details,
        ...insertedData
      } = data;
      insertedData.updated_at = this.utilsService.getTime();
      insertedData.created_at = this.utilsService.getTime();

      Object.keys(insertedData).forEach((key) => {
        if (typeof insertedData[key] === 'string') {
          insertedData[key] = insertedData[key].toUpperCase();
        }
      })

      const existingData = await trx(this.tableName).where('id', id).first();
      const hasChanges = this.utilsService.hasChanges(insertedData, existingData);

      if (hasChanges) {
        insertedData.updated_at = this.utilsService.getTime();

        await trx(this.tableName).where('id', id).update(insertedData);
      }
      
      if (details.length > 0) { // Check each detail, update or set id accordingly
        const detailsWithModifiedBy = details.map((detail: any) => ({
          ...detail,
          modifiedby: insertedData.modifiedby
        }))

        if (details.length > 0) {
          await this.scheduleDetailService.create(detailsWithModifiedBy, id, trx);
        }
      }
      
      // If there are details, call the service to handle create or update
      const { data: filteredItems } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false, 
        },
        trx,
      );

      let dataIndex = filteredItems.findIndex((item) => Number(item.id) === id);
      
      if (dataIndex === -1) {
        dataIndex = 0;
      }

      const pageNumber = Math.floor(dataIndex / limit) + 1;
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
          postingdari: `EDIT SCHEDULE HEADER`,
          idtrans: id,
          nobuktitrans: id,
          aksi: 'ADD',
          datajson: JSON.stringify(data),
          modifiedby: insertedData.modifiedby,
        },
        trx,
      );

      return {
        updatedItem: {
          id,
          ...data,
        },
        pageNumber,
        dataIndex,
      };
    } catch (error) {
      throw new Error(`Error: ${error.message}`);
    }
  }

  async delete(id: number, trx: any, modifiedby: string) {
    try {
      const deletedData = await this.utilsService.lockAndDestroy(id, this.tableName, 'id', trx);

      const deletedDataDetail = await this.utilsService.lockAndDestroy(id, 'scheduledetail', 'schedule_id', trx);

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE SCHEDULE HEADER',
          idtrans: deletedData.id,
          nobuktitrans: deletedData.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedData),
          modifiedby: modifiedby,
        },
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE SCHEDULE DETAIL',
          idtrans: deletedDataDetail.id,
          nobuktitrans: deletedDataDetail.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedDataDetail),
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
