import { Inject, Injectable } from '@nestjs/common';
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

@Injectable()
export class MarketingService {
  private readonly tableName = 'marketing';

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redisService: RedisService,
    private readonly logTrailService: LogtrailService,
    private readonly utilService: UtilsService,
    private readonly marketingOrderanService: MarketingorderanService,
    private readonly marketingBiayaService: MarketingbiayaService,
    private readonly marketingManagerService: MarketingmanagerService,
    private readonly marketingProsesFeeService: MarketingprosesfeeService,
    private readonly marketingDetailService: MarketingdetailService
  ) {}

  async create(data: any, trx: any) {
    try {
      let cabang_id
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
        marketingdetail,
        ...insertData
      } = data      
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
        cabang_id = (getIdCabangEmkl || getIdCabangEmkl?.id) ? getIdCabangEmkl?.id : 26
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
          modifiedby: insertDataWithCabangId.modifiedby
        }))
        // console.log('morderanWithMarketingId', morderanWithMarketingId);
        await this.marketingOrderanService.create(morderanWithMarketingId, insertNewData[0].id, trx)
      }
      
      if (marketingbiaya.length > 0) {
        const mbiayaWithMarketingId = marketingbiaya.map((detail: any) => ({
          ...detail,
          marketing_id: insertNewData[0].id, 
          modifiedby: insertDataWithCabangId.modifiedby
        }))
        // console.log('mbiayaWithMarketingId', mbiayaWithMarketingId);
        await this.marketingBiayaService.create(mbiayaWithMarketingId, insertNewData[0].id, trx)
      }
      
      if (marketingmanager.length > 0) {
        const marketingManagerWithMarketingId = marketingmanager.map((detail: any) => ({
          ...detail,
          marketing_id: insertNewData[0].id, 
          modifiedby: insertDataWithCabangId.modifiedby
        }))
        // console.log('marketingManagerWithMarketingId', marketingManagerWithMarketingId);
        await this.marketingManagerService.create(marketingManagerWithMarketingId, insertNewData[0].id, trx)
      }

      if (marketingprosesfee.length > 0) {
        const mprosesfeeWithMarketingId = marketingprosesfee.map((detail: any) => ({
          ...detail,
          marketing_id: insertNewData[0].id,
          modifiedby: insertDataWithCabangId.modifiedby
        }))
        // console.log('mprosesfeeWithMarketingId', mprosesfeeWithMarketingId);
        await this.marketingProsesFeeService.create(mprosesfeeWithMarketingId, insertNewData[0].id, trx)
      }

      console.log('marketingdetail', marketingdetail);
      
      if (marketingdetail.length > 0) {
        const mdetailWithMarketingId = marketingdetail.map((detail: any) => ({
          ...detail,
          marketing_id: insertNewData[0].id,
          modifiedby: insertDataWithCabangId.modifiedby
        }))
        console.log('mdetailWithMarketingId', mdetailWithMarketingId);
        await this.marketingDetailService.create(mdetailWithMarketingId, insertNewData[0].id, trx)
      }

      const newItem = insertNewData[0];
      const { data: filteredItems } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );

      let dataIndex = filteredItems.findIndex((item) => Number(item.id) === newItem.id);  // Cari index item baru di hasil yang sudah difilter
      if (dataIndex === -1) {
        dataIndex = 0;
      }

      const pageNumber = Math.floor(dataIndex / limit) + 1;
      const endIndex = pageNumber * limit;
      const limitedItems = filteredItems.slice(0, endIndex);  // Ambil data hingga halaman yang mencakup item baru

      await this.redisService.set(`${this.tableName}-allItems`, JSON.stringify(limitedItems),);
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
    { search, filters, pagination, sort, isLookUp } : FindAllParams,
    trx: any
  ) {
    try {
      let { page, limit } = pagination;
      page = page ?? 1;
      limit = limit ?? 0;  

      if (isLookUp) {
        const totalData = await trx(this.tableName).count('id as total').first();
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

      const query = trx(`${this.tableName} as u`)
      .select([
        'u.id',
        'u.nama',
        'u.keterangan',
        'u.statusaktif',
        'u.email',
        'u.karyawan_id',
        'u.tglmasuk',
        'u.cabang_id',
        'u.statustarget',
        'u.statusbagifee',
        'u.statusfeemanager',
        // 'u.marketingmanager_id',
        'u.marketinggroup_id',
        'u.statusprafee',
        'u.modifiedby',
        'u.created_at',
        'u.updated_at',
        'statusaktif.text as statusaktif_nama',
        'statusaktif.memo as memo',
        'cabang.nama as cabang_nama',
        'statustarget.text as statustarget_nama',
        'statusbagifee.text as statusbagifee_nama',
        'statusfeemanager.text as statusfeemanager_nama',
        // 'marketinggroup'
        'statusprafee.text as statusprafee_nama'
      ])
      .leftJoin('parameter as statusaktif', 'u.statusaktif', 'statusaktif.id')
      .leftJoin('cabang', 'u.cabang_id', 'cabang.id')
      .leftJoin('parameter as statustarget', 'u.statustarget', 'statustarget.id')
      .leftJoin('parameter as statusbagifee', 'u.statusbagifee', 'statusbagifee.id')
      .leftJoin('parameter as statusfeemanager', 'u.statusfeemanager', 'statusfeemanager.id')
      // .leftJoin('marketinggroup', 'u.marketinggroup', 'marketinggroup.id')
      .leftJoin('parameter as statusprafee', 'u.statusprafee', 'statusprafee.id')

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]').trim();
        query.where((builder) => {
          builder
            .orWhere('u.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('u.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('statusaktif.text', 'like', `%${sanitizedValue}%`)
            .orWhere('u.email', 'like', `%${sanitizedValue}%`)
            // .orWhere('u.karyawan_nama', 'like', `%${sanitizedValue}%`)
            .orWhere('u.tglmasuk', 'like', `%${sanitizedValue}%`)
            .orWhere('cabang.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('statustarget.text', 'like', `%${sanitizedValue}%`)
            .orWhere('statusbagifee.text', 'like', `%${sanitizedValue}%`)
            .orWhere('statusfeemanager.text', 'like', `%${sanitizedValue}%`)
            // .orWhere('u.marketinggroup', 'like', `%${sanitizedValue}%`)
            .orWhere('statusprafee.text', 'like', `%${sanitizedValue}%`)
            .orWhere('u.modifiedby', 'like', `%${sanitizedValue}%`)
            .orWhere('u.created_at', 'like', `%${sanitizedValue}%`)
            .orWhere('u.updated_at', 'like', `%${sanitizedValue}%`)
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
            } else if (key === 'statusaktif_nama') {
              query.andWhereRaw("statusaktif.text LIKE ?", [`%${sanitizedValue}%`]);
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
      console.error('Error fetching data marketing in service:', error);
      throw new Error('Failed to fetch data marketing in service');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} marketing`;
  }

  update(id: number, data: any) {
    return `This action updates a #${id} marketing`;
  }

  remove(id: number) {
    return `This action removes a #${id} marketing`;
  }
}
