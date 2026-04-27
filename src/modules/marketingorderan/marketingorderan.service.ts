import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreateMarketingorderanDto } from './dto/create-marketingorderan.dto';
import { UpdateMarketingorderanDto } from './dto/update-marketingorderan.dto';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { UtilsService } from 'src/utils/utils.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';

@Injectable()
export class MarketingorderanService {
  private readonly tableName = 'marketingorderan';
  private readonly logger = new Logger(MarketingorderanService.name);

  constructor(
    // @Inject('REDIS_CLIENT')
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}

  async create(
    marketingOrderanData: any,
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

      if (marketingOrderanData.length === 0) {
        await trx(this.tableName).delete().where('marketing_id', marketing_id);
        return;
      }

      const fixData = marketingOrderanData.map(
        ({ statusaktifOrderan_nama, ...marketingOrderanData }) => ({
          ...marketingOrderanData,
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

      // const processedData = mainDataToInsert.map((item: any) => ({  // Ensure each item has an idheader
      //   ...item,
      //   marketing_id: item.marketing_id ?? marketing_id
      // }))

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

      await trx(tempTableName).insert(openJson);
      //

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
          updated_at: trx.raw(`${tempTableName}.updated_at`),
        })
        .returning('*')
        .then((result: any) => result[0])
        .catch((error: any) => {
          console.error(
            'Error inserting data marketing orderan in service:',
            error,
            error.message,
          );
          throw error;
        });

      const insertedDataQuery = await trx(tempTableName) // Handle insertion if no update occurs
        .select([
          'marketing_id',
          'nama',
          'keterangan',
          'singkatan',
          'statusaktif',
          'info',
          'modifiedby',
          // trx.raw('? as marketing_id', [marketing_id]),
          'created_at',
          'updated_at',
        ])
        .where(`${tempTableName}.id`, '0');

      const getDeleted = await trx(this.tableName)
        .leftJoin(
          `${tempTableName}`,
          'marketingorderan.id',
          `${tempTableName}.id`,
        )
        .select(
          'marketingorderan.id',
          'marketingorderan.marketing_id',
          'marketingorderan.nama',
          'marketingorderan.keterangan',
          'marketingorderan.singkatan',
          'marketingorderan.statusaktif',
          'marketingorderan.info',
          'marketingorderan.modifiedby',
          'marketingorderan.created_at',
          'marketingorderan.updated_at',
        )
        .whereNull(`${tempTableName}.id`)
        .where('marketingorderan.marketing_id', marketing_id);

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
          'marketingorderan.id',
          `${tempTableName}.id`,
        )
        .whereNull(`${tempTableName}.id`)
        .where('marketingorderan.marketing_id', marketing_id)
        .del();

      if (insertedDataQuery.length > 0) {
        insertedData = await trx('marketingorderan')
          .insert(insertedDataQuery)
          .returning('*')
          .then((result: any) => result[0])
          .catch((error: any) => {
            console.error(
              'Error inserting data marketing orderan in service:',
              error,
            );
            throw error;
          });
      }

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD MARKETING ORDERAN FROM MARKETING',
          idtrans: marketing_id,
          nobuktitrans: marketing_id,
          aksi: 'EDIT',
          datajson: JSON.stringify(finalData),
          modifiedby: marketingOrderanData[0].modifiedby || 'UNKNOWN',
        },
        trx,
      );

      return updatedData || insertedData;
    } catch (error) {
      throw new Error(
        `Error inserted marketing orderan in service: ${error.message}`,
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

      const query = trx(`${this.tableName} as p`)
        .select(
          'p.id',
          'p.marketing_id',
          'p.nama',
          'p.keterangan',
          'p.singkatan',
          'p.statusaktif',
          'q.memo',
          'q.text as statusaktif_nama',
          'r.nama as marketing_nama',
        )
        .leftJoin('parameter as q', 'p.statusaktif', 'q.id')
        .leftJoin('marketing as r', 'p.marketing_id', 'r.id')
        .where('p.marketing_id', id)
        .orderBy('p.created_at', 'desc'); // Optional: Order by creation date

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('p.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('p.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('p.singkatan', 'like', `%${sanitizedValue}%`)
            // .orWhere('q.text', 'like', `%${sanitizedValue}%`)
            .orWhere('r.nama', 'like', `%${sanitizedValue}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'statusaktif_nama') {
              query.andWhere(`q.id`, '=', sanitizedValue);
            } else if (key === 'marketing_nama') {
              query.andWhere('r.nama', 'like', `%${sanitizedValue}%`);
            } else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      if (sort?.sortBy && sort?.sortDirection) {
        if (sort?.sortBy === 'marketing_nama') {
          query.orderBy('r.nama', sort.sortDirection);
        } else if (sort?.sortBy === 'statusaktif') {
          const memoExpr = 'TRY_CONVERT(nvarchar(max), q.memo)';
          query.orderByRaw(
            `JSON_VALUE(${memoExpr}, '$.MEMO') ${sort.sortDirection}`,
          );
        } else {
          query.orderBy(sort.sortBy, sort.sortDirection);
        }
      }

      const result = await query;

      if (!result.length) {
        this.logger.warn(
          `No data marketing orderan found for id marketing_id: ${id}`,
        );

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
    } catch (error) {
      console.error('Error to findAll Marketing Orderan', error);
      throw new Error(error);
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} marketingorderan`;
  }

  update(id: number, updateMarketingorderanDto: UpdateMarketingorderanDto) {
    return `This action updates a #${id} marketingorderan`;
  }

  remove(id: number) {
    return `This action removes a #${id} marketingorderan`;
  }
}
