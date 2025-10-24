import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateMarketingdetailDto } from './dto/create-marketingdetail.dto';
import { UpdateMarketingdetailDto } from './dto/update-marketingdetail.dto';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { LocksService } from '../locks/locks.service';

@Injectable()
export class MarketingdetailService {
  private readonly tableName = 'marketingdetail';
  private readonly logger = new Logger(MarketingdetailService.name);

  constructor(
    // @Inject('REDIS_CLIENT')
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly locksService: LocksService,
  ) {}

  async create(
    marketingDetailData: any,
    marketingprosesfee_id: any = 0,
    trx: any,
  ) {
    try {
      let insertedData = null;
      let data: any = null;
      const tempTableName = `##temp_${Math.random().toString(36).substring(2, 15)}`;
      const time = this.utilsService.getTime();
      const logData: any[] = [];
      const mainDataToInsert: any[] = [];
      const tableTemp = await this.utilsService.createTempTable(
        this.tableName,
        trx,
        tempTableName,
      );

      if (marketingDetailData.length === 0) {
        await trx(this.tableName)
          .delete()
          .where('marketingprosesfee_id', marketingprosesfee_id);
        return;
      }

      const fixData = marketingDetailData.map(
        ({ statusaktif_nama, ...marketingDetailData }) => ({
          ...marketingDetailData,
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

      await trx.raw(tableTemp);

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

      // **Update or Insert into 'marketingorderan' with correct idheader**
      const updatedData = await trx(this.tableName)
        .join(`${tempTableName}`, `${this.tableName}.id`, `${tempTableName}.id`)
        .update({
          marketing_id: trx.raw(`${tempTableName}.marketing_id`),
          marketingprosesfee_id: trx.raw(
            `${tempTableName}.marketingprosesfee_id`,
          ),
          nominalawal: trx.raw(`${tempTableName}.nominalawal`),
          nominalakhir: trx.raw(`${tempTableName}.nominalakhir`),
          persentase: trx.raw(`${tempTableName}.persentase`),
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
            'Error inserting data marketing detail in service:',
            error,
            error.message,
          );
          throw error;
        });

      const insertedDataQuery = await trx(tempTableName) // Handle insertion if no update occurs
        .select([
          'marketing_id',
          'marketingprosesfee_id',
          'nominalawal',
          'nominalakhir',
          'persentase',
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
          'marketingdetail.id',
          `${tempTableName}.id`,
        )
        .select(
          'marketingdetail.id',
          'marketingdetail.marketing_id',
          'marketingdetail.marketingprosesfee_id',
          'marketingdetail.nominalawal',
          'marketingdetail.nominalakhir',
          'marketingdetail.persentase',
          'marketingdetail.statusaktif',
          'marketingdetail.info',
          'marketingdetail.modifiedby',
          'marketingdetail.created_at',
          'marketingdetail.updated_at',
        )
        .whereNull(`${tempTableName}.id`)
        .where('marketingdetail.marketingprosesfee_id', marketingprosesfee_id);

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
          'marketingdetail.id',
          `${tempTableName}.id`,
        )
        .whereNull(`${tempTableName}.id`)
        .where('marketingdetail.marketingprosesfee_id', marketingprosesfee_id)
        .del();

      if (insertedDataQuery.length > 0) {
        insertedData = await trx('marketingdetail')
          .insert(insertedDataQuery)
          .returning('*')
          .then((result: any) => result[0])
          .catch((error: any) => {
            console.error(
              'Error inserting data marketing detail in service:',
              error,
            );
            throw error;
          });
      }

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD MARKETING PROSES FEE FROM MARKETING',
          idtrans: marketingprosesfee_id,
          nobuktitrans: marketingprosesfee_id,
          aksi: 'EDIT',
          datajson: JSON.stringify(finalData),
          modifiedby: fixData[0].modifiedby || 'UNKNOWN',
        },
        trx,
      );

      return updatedData || insertedData;
    } catch (error) {
      throw new Error(
        `Error inserted marketing detail in service: ${error.message}`,
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
          'u.marketingprosesfee_id',
          'u.nominalawal',
          'u.nominalakhir',
          'u.persentase',
          'u.statusaktif',
          'p.nama as marketing_nama',
          'q.memo',
          'q.text as statusaktif_nama',
        )
        .leftJoin('marketing as p', 'u.marketing_id', 'p.id')
        // .leftJoin('marketingprosesfee as r', 'p.marketingprosesfee_id', 'r.id')
        .leftJoin('parameter as q', 'u.statusaktif', 'q.id')
        .where('u.marketingprosesfee_id', id)
        .orderBy('u.created_at', 'desc');

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('p.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('u.nominalawal', 'like', `%${sanitizedValue}%`)
            .orWhere('u.nominalakhir', 'like', `%${sanitizedValue}%`)
            .orWhere('u.persentase', 'like', `%${sanitizedValue}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'statusaktif_nama') {
              query.andWhere(`q.id`, '=', sanitizedValue);
            } else if (key === 'marketing_nama') {
              query.andWhere('p.nama', 'like', `%${sanitizedValue}%`);
            } else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      if (sort?.sortBy && sort?.sortDirection) {
        if (sort.sortBy === 'marketing_nama') {
          query.orderBy('p.nama', sort.sortDirection);
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
          `No data marketing detail found for id marketingprosesfee_id: ${id}`,
        );

        return {
          status: false,
          message: 'No Data marketing detail Found',
          data: [],
        };
      }

      return {
        status: true,
        message: 'marketing detail data fetched successfully',
        data: result,
      };
    } catch (error) {
      console.error('Error to findAll Marketing Detail', error);
      throw new Error(error);
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
      console.error(
        'Error check validasi edit marketing detail di function checkValidasi:',
        error,
      );
      throw new InternalServerErrorException(
        'Failed to check validation edit marketing',
      );
    }
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
