import { Injectable, Logger } from '@nestjs/common';
import { CreateMarketingdetailDto } from './dto/create-marketingdetail.dto';
import { UpdateMarketingdetailDto } from './dto/update-marketingdetail.dto';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';

@Injectable()
export class MarketingdetailService {
  private readonly tableName = 'marketingdetail'
  private readonly logger = new Logger(MarketingdetailService.name)

  constructor (
    // @Inject('REDIS_CLIENT') 
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService
  ) {}

  async create(marketingDetailData: any, marketing_id: any = 0, trx: any = null) {
    try {
      let insertedData = null
      let data: any = null
      const tempTableName = `##temp_${Math.random().toString(36).substring(2, 15)}`;
      const time = this.utilsService.getTime()
      const logData: any[] = [];
      const mainDataToInsert: any[] = [];
      const columnInfo = await trx(this.tableName).columnInfo();
      const tableTemp = await this.utilsService.createTempTable(this.tableName, trx, tempTableName)

      if (marketingDetailData.length === 0) {
        await trx(this.tableName).delete().where('marketing_id', marketing_id)
        return;
      }

      const fixData = marketingDetailData.map(({ statusaktif_nama, ...marketingDetailData }) => ({
        ...marketingDetailData
      }))

      for (data of fixData) {
        let isDataChanged = false

        Object.keys(data).forEach((key) => {
          if (typeof data[key] === 'string') {
            data[key] = data[key].toUpperCase();
          }
        })

        if (data.id) {
          const existingData = await trx(this.tableName).where('id', data.id).first();
          if (existingData) {
            const createdAt = {
              created_at: existingData.created_at,
              updated_at: existingData.updated_at
            }
            Object.assign(data, createdAt)

            if (this.utilsService.hasChanges(data, existingData)) {
              data.updated_at = time;
              isDataChanged = true;
              data.aksi = 'UPDATE';
            }
          }
        } else {
          const newTimestamps = {
            created_at: time,
            updated_at: time
          }
          Object.assign(data, newTimestamps);
          isDataChanged = true;
          data.aksi = 'CREATE';
        }

        if (!isDataChanged) {
          data.aksi = 'NO UPDATE'
        }

        const { aksi, ...dataForInsert } = data
        mainDataToInsert.push(dataForInsert)
        logData.push({
          ...data,
          created_at: time
        })
      }
      
      await trx.raw(tableTemp) //CREATE TEMP TABLE

      const jsonString = JSON.stringify(mainDataToInsert)
      const mappingData = Object.keys(mainDataToInsert[0]).map((key) => [
        'value',
        `$.${key}`,
        key,
      ]);      

      const openJson = await trx
        .from(trx.raw('OPENJSON(?)', [jsonString]))
        .jsonExtract(mappingData)
        .as('jsonData');

      await trx(tempTableName).insert(openJson);
      // console.log('mainDataToInsert', mainDataToInsert, 'mappingData', mappingData, 'openJson', openJson);

      const updatedData = await trx('marketingorderan') // **Update or Insert into 'marketingorderan' with correct idheader**
      .join(`${tempTableName}`, 'marketingorderan.id', `${tempTableName}.id`)
      .update({ 
        marketing_id: trx.raw(`${tempTableName}.marketing_id`),
        nama: trx.raw(`${tempTableName}.nama`),
        keterangan: trx.raw(`${tempTableName}.keterangan`),
        singkatan: trx.raw(`${tempTableName}.singkatan`),
        statusaktif: trx.raw(`${tempTableName}.statusaktif`),
        info: trx.raw(`${tempTableName}.info`),
        modifiedby: trx.raw(`${tempTableName}.modifiedby`),
        created_at: trx.raw(`${tempTableName}.created_at`),
        updated_at: trx.raw(`${tempTableName}.updated_at`)
      })
      .returning('*')
      .then((result: any) => result[0])
      .catch((error: any) => {
        console.error( 'Error inserting data marketing orderan in service:', error, error.message);
        throw error;
      });   


    } catch (error) {
      throw new Error(`Error inserted marketing orderan in service: ${error.message}`);
    }
  }

  async findAll(id: string, trx: any) {
    const result = await trx((`${this.tableName} as p`))
    .select(
      'p.id',
      'p.marketing_id',
      'p.marketingprosesfee_id',
      'p.nominalawal',
      'p.nominalakhir',
      'p.persentase',
      'p.statusaktif',
      'q.nama as marketing_nama',
      '',
      'aktif.memo',
      'aktif.text as statusaktif_nama',
    )
    .leftJoin('marketing as q', 'p.marketing_id', 'q.id')
    .leftJoin('marketingprosesfee as r', 'p.marketingprosesfee_id', 'r.id')
    .leftJoin('parameter as aktif', 'p.statusaktif', 'aktif.id')
    .where('p.marketing_id', id)
    .orderBy('p.created_at', 'desc'); // Optional: Order by creation date
    
    // console.log('result', result);
    
    if (!result.length) {
      this.logger.warn(`No data marketing orderan found for id marketing_id: ${id}`);

      return {
        status: false,
        message: 'No Data marketing orderan Found',
        data: [],
      };
    }

    return {
      status: true,
      message: 'marketing orderan data fetched successfully',
      data: result,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} marketingdetail`;
  }

  update(id: number, updateMarketingdetailDto: UpdateMarketingdetailDto) {
    return `This action updates a #${id} marketingdetail`;
  }

  remove(id: number) {
    return `This action removes a #${id} marketingdetail`;
  }
}
