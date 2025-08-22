import { Injectable, Logger } from '@nestjs/common';
import { CreateMarketingprosesfeeDto } from './dto/create-marketingprosesfee.dto';
import { UpdateMarketingprosesfeeDto } from './dto/update-marketingprosesfee.dto';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';

@Injectable()
export class MarketingprosesfeeService {
  private readonly tableName = 'marketingprosesfee'
  private readonly logger = new Logger(MarketingprosesfeeService.name)

  constructor (
    // @Inject('REDIS_CLIENT') 
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService
  ) {}

  async create(marketingProsesFeeData: any, marketing_id: any = 0, trx: any = null) {
    try {
      let insertedData = null
      let data: any = null
      const tempTableName = `##temp_${Math.random().toString(36).substring(2, 15)}`;
      const time = this.utilsService.getTime()
      const logData: any[] = [];
      const mainDataToInsert: any[] = [];
      const columnInfo = await trx(this.tableName).columnInfo();
      const tableTemp = await this.utilsService.createTempTable(this.tableName, trx, tempTableName)

      if (marketingProsesFeeData.length === 0) {
        await trx(this.tableName).delete().where('marketing_id', marketing_id)
        return;
      }
      
      const fixData = marketingProsesFeeData.map(({ statusaktif_nama, jenisprosesfee_nama, statuspotong_nama, ...marketingProsesFeeData }) => ({
        ...marketingProsesFeeData
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

      const updatedData = await trx('marketingprosesfee') // **Update or Insert into 'marketingprosesfee' with correct idheader**
      .join(`${tempTableName}`, 'marketingprosesfee.id', `${tempTableName}.id`)
      .update({ 
        marketing_id: trx.raw(`${tempTableName}.marketing_id`),
        jenisprosesfee_id: trx.raw(`${tempTableName}.jenisprosesfee_id`),
        statuspotongbiayakantor: trx.raw(`${tempTableName}.statuspotongbiayakantor`),
        statusaktif: trx.raw(`${tempTableName}.statusaktif`),
        info: trx.raw(`${tempTableName}.info`),
        modifiedby: trx.raw(`${tempTableName}.modifiedby`),
        created_at: trx.raw(`${tempTableName}.created_at`),
        updated_at: trx.raw(`${tempTableName}.updated_at`)
      })
      .returning('*')
      .then((result: any) => result[0])
      .catch((error: any) => {
        console.error( 'Error inserting data marketing proses fee in service:', error, error.message);
        throw error;
      }); 

      const insertedDataQuery = await trx(tempTableName)  // Handle insertion if no update occurs
        .select([
          'marketing_id',
          'jenisprosesfee_id',
          'statuspotongbiayakantor',
          'statusaktif',
          'info',
          'modifiedby',
          'created_at',
          'updated_at',
        ])
        .where(`${tempTableName}.id`, '0');

      const getDeleted = await trx(this.tableName)
        .leftJoin(`${tempTableName}`, 'marketingprosesfee.id', `${tempTableName}.id`)
        .select(
          'marketingprosesfee.id',
          'marketingprosesfee.marketing_id',
          'marketingprosesfee.jenisprosesfee_id',
          'marketingprosesfee.statuspotongbiayakantor',
          'marketingprosesfee.statusaktif',
          'marketingprosesfee.info',
          'marketingprosesfee.modifiedby',
          'marketingprosesfee.created_at',
          'marketingprosesfee.updated_at',
        )
        .whereNull(`${tempTableName}.id`)
        .where('marketingprosesfee.marketing_id', marketing_id);

      let pushToLog: any[] = [];

      if (getDeleted.length > 0) {
        pushToLog = Object.assign(getDeleted, { aksi: 'DELETE' });
      }

      const pushToLogWithAction = pushToLog.map((entry) => ({ ...entry, aksi: 'DELETE' }));

      const finalData = logData.concat(pushToLogWithAction);

      const deletedData = await trx(this.tableName)
        .leftJoin(`${tempTableName}`, 'marketingprosesfee.id', `${tempTableName}.id`)
        .whereNull(`${tempTableName}.id`)
        .where('marketingprosesfee.marketing_id', marketing_id)
        .del();

      if (insertedDataQuery.length > 0) {
        insertedData = await trx('marketingprosesfee')
          .insert(insertedDataQuery)
          .returning('*')
          .then((result: any) => result[0])
          .catch((error: any) => {
            console.error('Error inserting data marketing proses fee in service:', error);
            throw error;
          });
      }

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD MARKETING PROSES FEE FROM MARKETING',
          idtrans: marketing_id,
          nobuktitrans: marketing_id,
          aksi: 'EDIT',
          datajson: JSON.stringify(finalData),
          modifiedby: marketingProsesFeeData[0].modifiedby || 'UNKNOWN',
        },
        trx,
      );

      console.log('return insertedData', insertedData, 'updatedData', updatedData);
      return updatedData || insertedData;


    } catch (error) {
      throw new Error(`Error inserted marketing proses fee in service: ${error.message}`);
    }
  }

  async findAll(id: string, trx: any) {
    const result = await trx((`${this.tableName} as p`))
    .select(
      'p.id',
      'p.marketing_id',
      'p.jenisprosesfee_id',
      'p.statuspotongbiayakantor',
      'p.statusaktif',
      'statusaktif.memo',
      'statusaktif.text as statusaktif_nama',
      'statuspotong.memo as statuspotongbiayakantor_memo',
      'statuspotong.text as statuspotongbiayakantor_nama',
      'q.nama as marketing_nama',
      // 'r.nama as jenisprosesfee_nama'
    )
    .leftJoin('parameter as statusaktif', 'p.statusaktif', 'statusaktif.id')
    .leftJoin('parameter as statuspotong', 'p.statusaktif', 'statuspotong.id')
    .leftJoin('marketing as q', 'p.marketing_id', 'q.id')
    // .leftJoin('jenisprosesfee as r', 'p.jenisprosesfee_id', 'r.id')
    .where('p.marketing_id', id)
    .orderBy('p.created_at', 'desc'); // Optional: Order by creation date
    
    
    if (!result.length) {
      this.logger.warn(`No data marketing proses fee found for id marketing_id: ${id}`);

      return {
        status: false,
        message: 'No Data marketing proses fee Found',
        data: [],
      };
    }

    return {
      status: true,
      message: 'marketing proses fee data fetched successfully',
      data: result,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} marketingprosesfee`;
  }

  update(id: number, updateMarketingprosesfeeDto: UpdateMarketingprosesfeeDto) {
    return `This action updates a #${id} marketingprosesfee`;
  }

  remove(id: number) {
    return `This action removes a #${id} marketingprosesfee`;
  }
}
