import { Injectable, Logger } from '@nestjs/common';
import { CreateMarketingbiayaDto } from './dto/create-marketingbiaya.dto';
import { UpdateMarketingbiayaDto } from './dto/update-marketingbiaya.dto';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';

@Injectable()
export class MarketingbiayaService {
  private readonly tableName = 'marketingbiaya';
  private readonly logger = new Logger(MarketingbiayaService.name);

  constructor(
    // @Inject('REDIS_CLIENT')
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}

  async create(
    marketingBiayaData: any,
    marketing_id: any = 0,
    trx: any = null,
  ) {
    try {
      let insertedData = null;
      let data: any = null;
      const tempTableName = `##temp_${Math.random().toString(36).substring(2, 15)}`;
      const time = this.utilsService.getTime();
      const logData: any[] = [];
      const mainDataToInsert: any[] = [];
      const columnInfo = await trx(this.tableName).columnInfo();
      const tableTemp = await this.utilsService.createTempTable(
        this.tableName,
        trx,
        tempTableName,
      );

      if (marketingBiayaData.length === 0) {
        await trx(this.tableName).delete().where('marketing_id', marketing_id);
        return;
      }

      const fixData = marketingBiayaData.map(
        ({
          statusaktifBiaya_nama,
          jenisbiayamarketing_nama,
          ...marketingBiayaData
        }) => ({
          ...marketingBiayaData,
        }),
      );

      for (data of fixData) {
        let isDataChanged = false;

        Object.keys(data).forEach((key) => {
          if (typeof data[key] === 'string') {
            data[key] = data[key].toUpperCase();
          }
        });

        if (data.id) {
          const existingData = await trx(this.tableName)
            .where('id', data.id)
            .first();
          if (existingData) {
            const createdAt = {
              created_at: existingData.created_at,
              updated_at: existingData.updated_at,
            };
            Object.assign(data, createdAt);

            if (this.utilsService.hasChanges(data, existingData)) {
              data.updated_at = time;
              isDataChanged = true;
              data.aksi = 'UPDATE';
            }
          }
        } else {
          const newTimestamps = {
            created_at: time,
            updated_at: time,
          };
          Object.assign(data, newTimestamps);
          isDataChanged = true;
          data.aksi = 'CREATE';
        }

        if (!isDataChanged) {
          data.aksi = 'NO UPDATE';
        }

        const { aksi, ...dataForInsert } = data;
        mainDataToInsert.push(dataForInsert);
        logData.push({
          ...data,
          created_at: time,
        });
      }

      await trx.raw(tableTemp); //CREATE TEMP TABLE

      const jsonString = JSON.stringify(mainDataToInsert);
      const mappingData = Object.keys(mainDataToInsert[0]).map((key) => [
        'value',
        `$.${key}`,
        key,
      ]);

      const openJson = await trx
        .from(trx.raw('OPENJSON(?)', [jsonString]))
        .jsonExtract(mappingData)
        .as('jsonData');
      // console.log('mainDataToInsert', mainDataToInsert, 'logData', logData, 'openJson', openJson);

      await trx(tempTableName).insert(openJson);

      const updatedData = await trx(this.tableName) // **Update or Insert into 'marketingbiaya' with correct idheader**
        .join(`${tempTableName}`, `${this.tableName}.id`, `${tempTableName}.id`)
        .update({
          marketing_id: trx.raw(`${tempTableName}.marketing_id`),
          jenisbiayamarketing_id: trx.raw(
            `${tempTableName}.jenisbiayamarketing_id`,
          ),
          nominal: trx.raw(`${tempTableName}.nominal`),
          statusaktif: trx.raw(`${tempTableName}.statusaktif`),
          info: trx.raw(`${tempTableName}.info`),
          modifiedby: trx.raw(`${tempTableName}.modifiedby`),
          created_at: trx.raw(`${tempTableName}.created_at`),
          updated_at: trx.raw(`${tempTableName}.updated_at`),
        })
        .returning('*')
        .then((result: any) => result[0])
        .catch((error: any) => {
          console.error(
            'Error inserting data marketing biaya in service:',
            error,
            error.message,
          );
          throw error;
        });

      const insertedDataQuery = await trx(tempTableName) // Handle insertion if no update occurs
        .select([
          'marketing_id',
          'jenisbiayamarketing_id',
          'nominal',
          'statusaktif',
          'info',
          'modifiedby',
          'created_at',
          'updated_at',
        ])
        .where(`${tempTableName}.id`, '0');

      const getDeleted = await trx(this.tableName)
        .leftJoin(
          `${tempTableName}`,
          'marketingbiaya.id',
          `${tempTableName}.id`,
        )
        .select(
          'marketingbiaya.id',
          'marketingbiaya.marketing_id',
          'marketingbiaya.jenisbiayamarketing_id',
          'marketingbiaya.nominal',
          'marketingbiaya.statusaktif',
          'marketingbiaya.info',
          'marketingbiaya.modifiedby',
          'marketingbiaya.created_at',
          'marketingbiaya.updated_at',
        )
        .whereNull(`${tempTableName}.id`)
        .where('marketingbiaya.marketing_id', marketing_id);

      let pushToLog: any[] = [];

      if (getDeleted.length > 0) {
        pushToLog = Object.assign(getDeleted, { aksi: 'DELETE' });
      }

      const pushToLogWithAction = pushToLog.map((entry) => ({
        ...entry,
        aksi: 'DELETE',
      }));

      const finalData = logData.concat(pushToLogWithAction);

      const deletedData = await trx(this.tableName)
        .leftJoin(
          `${tempTableName}`,
          'marketingbiaya.id',
          `${tempTableName}.id`,
        )
        .whereNull(`${tempTableName}.id`)
        .where('marketingbiaya.marketing_id', marketing_id)
        .del();

      if (insertedDataQuery.length > 0) {
        insertedData = await trx('marketingbiaya')
          .insert(insertedDataQuery)
          .returning('*')
          .then((result: any) => result[0])
          .catch((error: any) => {
            console.error(
              'Error inserting data marketing biaya in service:',
              error,
            );
            throw error;
          });
      }

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD MARKETING BIAYA FROM MARKETING',
          idtrans: marketing_id,
          nobuktitrans: marketing_id,
          aksi: 'EDIT',
          datajson: JSON.stringify(finalData),
          modifiedby: marketingBiayaData[0].modifiedby || 'UNKNOWN',
        },
        trx,
      );

      console.log(
        'haii return insertedData',
        insertedData,
        'updatedData',
        updatedData,
      );
      return updatedData || insertedData;
    } catch (error) {
      throw new Error(
        `Error inserted marketing biaya in service: ${error.message}`,
      );
    }
  }

  async findAll(
    id: string, 
    trx: any,
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
  ) {
    try {
      let { page, limit } = pagination ?? {};
      page = page ?? 1;
      limit = limit ?? 0;
    
      const query = trx(`${this.tableName} as u`)
        .select(
          'u.id',
          'u.marketing_id',
          'u.jenisbiayamarketing_id',
          'u.nominal',
          'u.statusaktif',
          'p.memo',
          'p.text as statusaktif_nama',
          'q.nama as marketing_nama',
          'r.nama as jenisbiayamarketing_nama',
        )
        .leftJoin('parameter as p', 'u.statusaktif', 'p.id')
        .leftJoin('marketing as q', 'u.marketing_id', 'q.id')
        .leftJoin('jenisbiayamarketing as r', 'u.jenisbiayamarketing_id', 'r.id')
        .where('u.marketing_id', id)
        .orderBy('u.created_at', 'desc'); // Optional: Order by creation date

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('u.nominal', 'like', `%${sanitizedValue}%`)
            // .orWhere('p.text', 'like', `%${sanitizedValue}%`)
            .orWhere('q.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('r.nama', 'like', `%${sanitizedValue}%`)
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'statusaktif_nama') {
              query.andWhere(`p.id`, '=', sanitizedValue);
            } else if (key === 'marketing_nama') {
              query.andWhere('q.nama', 'like', `%${sanitizedValue}%`);
            } else if (key === 'jenisbiayamarketing_nama') {
              query.andWhere('r.nama', 'like', `%${sanitizedValue}%`);
            } else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      if (sort?.sortBy && sort?.sortDirection) {
        query.orderBy(sort.sortBy, sort.sortDirection);
      }

      const result = await query;
      if (!result.length) {
        this.logger.warn(
          `No data marketing biaya found for id marketing_id: ${id}`,
        );

        return {
          status: false,
          message: 'No Data marketing biaya Found',
          data: [],
        };
      }

      return {
        status: true,
        message: 'marketing biaya data fetched successfully',
        data: result,
      };
    } catch (error) {
      console.error('Error to findAll Marketing Biaya', error, error.message);
      throw new Error(error);
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} marketingbiaya`;
  }

  update(id: number, updateMarketingbiayaDto: UpdateMarketingbiayaDto) {
    return `This action updates a #${id} marketingbiaya`;
  }

  remove(id: number) {
    return `This action removes a #${id} marketingbiaya`;
  }
}
