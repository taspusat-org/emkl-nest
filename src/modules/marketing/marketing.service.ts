import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateMarketingDto } from './dto/create-marketing.dto';
// import { UpdateMarketingDto } from './dto/update-marketing.dto';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { dbHr } from 'src/common/utils/db';
import { DateTime } from 'luxon';
import { MarketingorderanService } from '../marketingorderan/marketingorderan.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { MarketingbiayaService } from '../marketingbiaya/marketingbiaya.service';
import { MarketingmanagerService } from '../marketingmanager/marketingmanager.service';
import { MarketingprosesfeeService } from '../marketingprosesfee/marketingprosesfee.service';
import { MarketingdetailService } from '../marketingdetail/marketingdetail.service';
import { LocksService } from '../locks/locks.service';

@Injectable()
export class MarketingService {
  private readonly tableName = 'marketing';

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redisService: RedisService,
    private readonly logTrailService: LogtrailService,
    private readonly utilService: UtilsService,
    private readonly locksService: LocksService,
    private readonly marketingOrderanService: MarketingorderanService,
    private readonly marketingBiayaService: MarketingbiayaService,
    private readonly marketingManagerService: MarketingmanagerService,
    private readonly marketingProsesFeeService: MarketingprosesfeeService,
    private readonly marketingDetailService: MarketingdetailService,
  ) {}

  async create(data: any, trx: any) {
    try {
      let cabang_id;
      // const time = this.utilService.getTime();
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        statusaktif_nama,
        karyawan_nama,
        statustarget_nama,
        statusbagifee_nama,
        statusfeemanager_nama,
        marketinggroup_nama,
        statusprafee_nama,
        marketingorderan,
        marketingbiaya,
        marketingmanager,
        marketingprosesfee,
        // marketingdetail,
        ...insertData
      } = data;
      insertData.updated_at = this.utilService.getTime();
      insertData.created_at = this.utilService.getTime();
      // console.log(
      //   'masuk sinii',
      //   'data', insertData,
      //   'marketingorderan', marketingorderan,
      //   'marketingbiaya', marketingbiaya,
      //   'marketingmanager', marketingmanager,
      //   'marketingprosesfee', marketingprosesfee,
      //   'marketingdetail', marketingdetail
      // );

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          const value = insertData[key];
          const dateRegex = /^\d{2}-\d{2}-\d{4}$/;

          if (dateRegex.test(value)) {
            insertData[key] = formatDateToSQL(value);
          } else {
            insertData[key] = insertData[key].toUpperCase();
          }
        }
      });

      if (data.karyawan_id != null) {
        const cekIdCabang = await dbHr('karyawan').select('id', 'namakaryawan', 'cabang_id').where('id', insertData.karyawan_id).first();
        const cekNamaCabang = await dbHr('cabang').select('nama').where('id', cekIdCabang.cabang_id).first();
        const getIdCabangEmkl = await trx('cabang').select('id').where('nama', cekNamaCabang.nama).first();
        cabang_id = getIdCabangEmkl?.id ? getIdCabangEmkl?.id : 2;
        // console.log('tes', cekIdCabang.cabang_id, cekNamaCabang, cekNamaCabang.nama, getIdCabangEmkl, cabang_id);
      }

      const insertDataWithCabangId = {
        ...insertData,
        cabang_id: cabang_id
      }
      
      const insertNewData = await trx(this.tableName).insert(insertDataWithCabangId).returning('*');

      if (marketingorderan.length > 0) {
        const morderanWithMarketingId = marketingorderan.map((detail: any) => ({
          ...detail,
          marketing_id: insertNewData[0].id,
          modifiedby: insertDataWithCabangId.modifiedby,
        }));
        // console.log('morderanWithMarketingId', morderanWithMarketingId);
        await this.marketingOrderanService.create(
          morderanWithMarketingId,
          insertNewData[0].id,
          trx,
        );
      }

      if (marketingbiaya.length > 0) {
        const mbiayaWithMarketingId = marketingbiaya.map((detail: any) => ({
          ...detail,
          marketing_id: insertNewData[0].id,
          modifiedby: insertDataWithCabangId.modifiedby,
        }));
        // console.log('mbiayaWithMarketingId', mbiayaWithMarketingId);
        await this.marketingBiayaService.create(
          mbiayaWithMarketingId,
          insertNewData[0].id,
          trx,
        );
      }

      if (marketingmanager.length > 0) {
        const marketingManagerWithMarketingId = marketingmanager.map((detail: any) => ({
          ...detail,
          marketing_id: insertNewData[0].id, 
          modifiedby: insertDataWithCabangId.modifiedby
        }))
        await this.marketingManagerService.create(marketingManagerWithMarketingId, insertNewData[0].id, trx)
      }

      if (marketingprosesfee.length > 0) {
        const mprosesfeeWithMarketingId = marketingprosesfee.map((detail: any) => ({
          ...detail,
          marketing_id: insertNewData[0].id,
          modifiedby: insertDataWithCabangId.modifiedby
        }))
        await this.marketingProsesFeeService.create(mprosesfeeWithMarketingId, insertNewData[0].id, trx)
      }

      
      // if (marketingdetail.length > 0) {
      //   const mdetailWithMarketingId = marketingdetail.map((detail: any) => ({
      //     ...detail,
      //     marketing_id: insertNewData[0].id,
      //     modifiedby: insertDataWithCabangId.modifiedby
      //   }))
      //   console.log('mdetailWithMarketingId', mdetailWithMarketingId);
      //   await this.marketingDetailService.create(mdetailWithMarketingId, insertNewData[0].id, trx)
      // }

      const newItem = insertNewData[0];
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

      let dataIndex = filteredItems.findIndex((item) => item.id === newItem.id); 
      if (dataIndex === -1) {
        dataIndex = 0;
      }

      const pageNumber = Math.floor(dataIndex / limit) + 1;
      const endIndex = pageNumber * limit;
      const limitedItems = filteredItems.slice(0, endIndex); // Ambil data hingga halaman yang mencakup item baru

      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );
      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: `ADD MARKETING`,
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
          return {
            data: {
              type: 'json',
            },
          };
        } else {
          limit = 0;
        }
      }

      const tempTableMarketingGroup = `##temp_${Math.random().toString(36).substring(2, 15)}`;
      const tempMarketingGroup = await this.utilService.createTempTable('marketinggroup', trx, tempTableMarketingGroup)
      await trx.raw(tempMarketingGroup);
      await trx.raw(`ALTER TABLE ${tempTableMarketingGroup} ADD marketinggroup_nama nvarchar(200) NULL`);      

      const getMarketingGroup = await trx('marketinggroup as a')
      .select([
        'a.id',
        'a.marketing_id',
        'a.statusaktif',
        'a.info',
        'a.modifiedby',
        'a.created_at',
        'a.updated_at',
        'marketing.nama as marketinggroup_nama',
      ])
      .leftJoin('marketing', 'a.marketing_id', 'marketing.id')

      const jsonString = JSON.stringify(getMarketingGroup)
      const mappingData = Object.keys(getMarketingGroup[0]).map((key) => [
        'value',
        `$.${key}`,
        key,
      ]);      

      const openJson = await trx
        .from(trx.raw('OPENJSON(?)', [jsonString]))
        .jsonExtract(mappingData)
        .as('jsonData');

      await trx(tempTableMarketingGroup).insert(openJson);

      const query = trx(`${this.tableName} as u`)
      .select([
        'u.id',
        'u.nama',
        'u.keterangan',
        'u.statusaktif',
        'u.email',
        'u.karyawan_id',
        trx.raw("FORMAT(u.tglmasuk, 'dd-MM-yyyy') as tglmasuk"),
        'u.cabang_id',
        'u.statustarget',
        'u.statusbagifee',
        'u.statusfeemanager',
        // 'u.marketingmanager_id',
        'u.marketinggroup_id',
        'u.statusprafee',
        'u.modifiedby',
        trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
        trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
        'statusaktif.text as statusaktif_nama',
        'statusaktif.memo as memo',
        'cabang.nama as cabang_nama',
        'statustarget.text as statustarget_nama',
        'statusbagifee.text as statusbagifee_nama',
        'statusfeemanager.text as statusfeemanager_nama',
        `tmg.marketinggroup_nama as marketinggroup_nama`,
        'statusprafee.text as statusprafee_nama',
        'karyawan.namakaryawan as karyawan_nama'
      ])
      .leftJoin('parameter as statusaktif', 'u.statusaktif', 'statusaktif.id')
      .leftJoin('cabang', 'u.cabang_id', 'cabang.id')
      .leftJoin('parameter as statustarget', 'u.statustarget', 'statustarget.id')
      .leftJoin('parameter as statusbagifee', 'u.statusbagifee', 'statusbagifee.id')
      .leftJoin('parameter as statusfeemanager', 'u.statusfeemanager', 'statusfeemanager.id')
      .leftJoin(`${tempTableMarketingGroup} as tmg`, 'u.marketinggroup_id', `tmg.id`)
      .leftJoin(`hr.dbo.karyawan as karyawan`, 'u.karyawan_id', 'karyawan.id')
      .leftJoin('parameter as statusprafee', 'u.statusprafee', 'statusprafee.id')

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]').trim();
        query.where((builder) => {
          builder
            .orWhere('u.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('u.keterangan', 'like', `%${sanitizedValue}%`)
            // .orWhere('statusaktif.text', 'like', `%${sanitizedValue}%`)
            .orWhere('u.email', 'like', `%${sanitizedValue}%`)
            .orWhere('karyawan.namakaryawan', 'like', `%${sanitizedValue}%`)
            .orWhereRaw("FORMAT(u.tglmasuk, 'dd-MM-yyyy') LIKE ?", [`%${sanitizedValue}%`])
            .orWhere('cabang.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('statustarget.text', 'like', `%${sanitizedValue}%`)
            .orWhere('statusbagifee.text', 'like', `%${sanitizedValue}%`)
            .orWhere('statusfeemanager.text', 'like', `%${sanitizedValue}%`)
            .orWhere('tmg.marketinggroup_nama', 'like', `%${sanitizedValue}%`)
            .orWhere('statusprafee.text', 'like', `%${sanitizedValue}%`)
            .orWhere('u.modifiedby', 'like', `%${sanitizedValue}%`)
            .orWhere('u.created_at', 'like', `%${sanitizedValue}%`)
            .orWhere('u.updated_at', 'like', `%${sanitizedValue}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'created_at' || key === 'updated_at') {
              query.andWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [key, `%${sanitizedValue}%`]);
            } else if (key === 'tglmasuk') {
              query.andWhereRaw("FORMAT(u.??, 'dd-MM-yyyy') LIKE ?", [key, `%${sanitizedValue}%`]);
            } else if (key === 'karyawan_nama') {
              query.andWhereRaw("karyawan.namakaryawan LIKE ?", [`%${sanitizedValue}%`]);
            } else if (key === 'cabang_nama') {
              query.andWhereRaw("cabang.nama LIKE ?", [`%${sanitizedValue}%`]);
            } else if (key === 'marketinggroup_nama') {
              query.andWhereRaw("tmg.marketinggroup_nama LIKE ?", [`%${sanitizedValue}%`]);
            } else if (key === 'statustarget_nama') {
              query.andWhereRaw("statustarget.text LIKE ?", [`%${sanitizedValue}%`]);
            } else if (key === 'statusbagifee_nama') {
              query.andWhereRaw("statusbagifee.text LIKE ?", [`%${sanitizedValue}%`]);
            } else if (key === 'statusfeemanager_nama') {
              query.andWhereRaw("statusfeemanager.text LIKE ?", [`%${sanitizedValue}%`]);
            } else if (key === 'statusprafee_nama') {
              query.andWhereRaw("statusprafee.text LIKE ?", [`%${sanitizedValue}%`]);
            } else if (key === 'statusaktif_nama') {
              query.andWhere('statusaktif.id', '=', sanitizedValue);
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
      const totalPages = Math.ceil(total / limit);
      // console.log('result',result, 'total', total, 'totalPages',totalPages, 'page limit di findall');

      if (sort?.sortBy && sort.sortDirection) {
        if (sort?.sortBy === 'marketinggroup') {
          query.orderBy('tmg.marketinggroup_nama', sort.sortDirection)
        } else if (sort?.sortBy === 'karyawan') {
          // query.orderBy('karyawan.nama', sort.sortDirection)
        } else if (sort?.sortBy === 'cabang') {
          // query.orderBy('cabang.nama', sort.sortDirection)
        } else {
          query.orderBy(sort.sortBy, sort.sortDirection)
        }
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
          itemPerPage: limit,
        },
      };
    } catch (error) {
      console.error('Error fetching data marketing in service:', error);
      throw new Error('Failed to fetch data marketing in service');
    }
  }

  async findAllLookupKaryawan({
    search,
    filters,
    pagination,
    isLookUp,
    sort,
  }: FindAllParams) {
    try {
      let { page, limit } = pagination;
      page = page ?? 1;
      limit = limit ?? 0;
      const offset = (page - 1) * limit;
      
      if (isLookUp) {
        const karyawanHrCount = await dbHr('karyawan').count('id as total').first();
        const totalDataKaryawanHr = karyawanHrCount?.total || 0;
        // console.log('isLookUp', isLookUp, 'karyawanHrCount', karyawanHrCount, 'totalDataKaryawanHr', totalDataKaryawanHr);

        if (Number(totalDataKaryawanHr) > 500) {
          return { data: { type: 'json' } };
        } else {
          limit = 0; // If ACO records are below 500, return all data
        }
      }

      const getIdStatusAktif = await dbHr('parameter').select('id').where('grp', '=', 'STATUS AKTIF').where('text', '=', 'AKTIF').first();      
      const query = dbHr('karyawan').select('id', 'namakaryawan').where('statusaktif', '=', getIdStatusAktif.id);

      if (limit > 0) {
        query.limit(limit).offset(offset);
      }

      if (search) {
        query.where((builder) => {
          builder.orWhere('namakaryawan', 'like', `%${search}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value) {
            query.andWhere(key, 'like', `%${value}%`);
          }
        }
      }

      const result = await dbHr('karyawan').count('id as total').first();
      const total = result?.total as number;
      const totalPages = Math.ceil(total / limit);
      const responseType = Number(total) > 500 ? 'json' : 'local';

      if (sort?.sortBy && sort?.sortDirection) {
        query.orderBy(sort.sortBy, sort.sortDirection);
      }

      const dataLookupKaryawan = await query;
      
      return {
        data: dataLookupKaryawan,
        total,
        type: responseType,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      console.error('Error fetching data lookup karyawan hr in service marketing:', error, error.message);
      throw new Error('Failed to fetch data lookup karyawan hr in service marketing');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} marketing`;
  }

  async update(id: number, data: any, trx: any) {
    try {
      let cabang_id
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        statusaktif_nama,
        karyawan_nama,
        statustarget_nama,
        statusbagifee_nama,
        statusfeemanager_nama,
        marketinggroup_nama,
        statusprafee_nama,
        marketingorderan,
        marketingbiaya,
        marketingmanager,
        marketingprosesfee,
        ...insertData
      } = data      
      insertData.updated_at = this.utilService.getTime();
      insertData.created_at = this.utilService.getTime();

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          const value = insertData[key];
          const dateRegex = /^\d{2}-\d{2}-\d{4}$/;

          if (dateRegex.test(value)) {
            insertData[key] = formatDateToSQL(value);
          } else {
            insertData[key] = insertData[key].toUpperCase();
          }
        }
      });
      
      if (data.karyawan_id != null) {
        const cekIdCabang = await dbHr('karyawan').select('id', 'namakaryawan', 'cabang_id').where('id', insertData.karyawan_id).first();
        const cekNamaCabang = await dbHr('cabang').select('nama').where('id', cekIdCabang.cabang_id).first();
        const getIdCabangEmkl = await trx('cabang').select('id').where('nama', cekNamaCabang.nama).first();
        cabang_id = (getIdCabangEmkl || getIdCabangEmkl?.id) ? getIdCabangEmkl?.id : 26
      }

      const insertDataWithCabangId = {
        ...insertData,
        cabang_id: cabang_id
      }

      const existingData = await trx(this.tableName).where('id', id).first();
      const hasChanges = this.utilService.hasChanges(
        insertDataWithCabangId,
        existingData,
      );

      if (hasChanges) {
        insertDataWithCabangId.updated_at = this.utilService.getTime();

        await trx(this.tableName).where('id', id).update(insertDataWithCabangId);
      }

      if (marketingorderan.length > 0) {
        const morderanWithMarketingId = marketingorderan.map((detail: any) => ({
          ...detail,
          modifiedby: insertDataWithCabangId.modifiedby
        }))
        await this.marketingOrderanService.create(morderanWithMarketingId, id, trx)
      }
      
      if (marketingbiaya.length > 0) {
        const mbiayaWithMarketingId = marketingbiaya.map((detail: any) => ({
          ...detail, 
          modifiedby: insertDataWithCabangId.modifiedby
        }))
        await this.marketingBiayaService.create(mbiayaWithMarketingId, id, trx)
      }
      
      if (marketingmanager.length > 0) {
        const marketingManagerWithMarketingId = marketingmanager.map((detail: any) => ({
          ...detail, 
          modifiedby: insertDataWithCabangId.modifiedby
        }))
        await this.marketingManagerService.create(marketingManagerWithMarketingId, id, trx)
      }

      if (marketingprosesfee.length > 0) {
        const mprosesfeeWithMarketingId = marketingprosesfee.map((detail: any) => ({
          ...detail,
          modifiedby: insertDataWithCabangId.modifiedby
        }))
        await this.marketingProsesFeeService.create(mprosesfeeWithMarketingId, id, trx)
      }

      const { data: filteredItems } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit: 0 },
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
      const limitedItems = filteredItems.slice(0, endIndex);  // Ambil data hingga halaman yang mencakup item baru

      await this.redisService.set(`${this.tableName}-allItems`, JSON.stringify(limitedItems));
      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: `EDIT SCHEDULE HEADER`,
          idtrans: id,
          nobuktitrans: id,
          aksi: 'ADD',
          datajson: JSON.stringify(data),
          modifiedby: insertData.modifiedby,
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
      const deletedData = await this.utilService.lockAndDestroy(id, this.tableName, 'id', trx);

      const deletedMarketingOrderan = await this.utilService.lockAndDestroy(id, 'marketingorderan', 'marketing_id', trx);
      const deletedMarketingBiaya = await this.utilService.lockAndDestroy(id, 'marketingbiaya', 'marketing_id', trx);
      const deletedMarketingManager = await this.utilService.lockAndDestroy(id, 'marketingmanager', 'marketing_id', trx);
      const deletedMarketingProsesFee = await this.utilService.lockAndDestroy(id, 'marketingprosesfee', 'marketing_id', trx);

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE MARKETING',
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
          postingdari: 'DELETE MARKETING ORDERAN',
          idtrans: deletedMarketingOrderan.id,
          nobuktitrans: deletedMarketingOrderan.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedMarketingOrderan),
          modifiedby: modifiedby,
        },
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE MARKETING BIAYA',
          idtrans: deletedMarketingBiaya.id,
          nobuktitrans: deletedMarketingBiaya.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedMarketingBiaya),
          modifiedby: modifiedby,
        },
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE MARKETING MANAGER',
          idtrans: deletedMarketingManager.id,
          nobuktitrans: deletedMarketingManager.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedMarketingManager),
          modifiedby: modifiedby,
        },
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE MARKETING PROSES FEE',
          idtrans: deletedMarketingProsesFee.id,
          nobuktitrans: deletedMarketingProsesFee.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedMarketingProsesFee),
          modifiedby: modifiedby,
        },
        trx,
      );
    } catch (error) {
      console.error('Error deleting data marketing in service:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete data marketing in service');
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
      // } else if (aksi === 'DELETE') {
      //   const validasi = await this.globalService.checkUsed(
      //     'akunpusat',
      //     'type_id',
      //     value,
      //     trx,
      //   );

      //   return validasi;
      }
    } catch (error) {
      console.error('Error di checkValidasi:', error);
      throw new InternalServerErrorException('Failed to check validation');
    }
  }
}
