import { Injectable, Logger } from '@nestjs/common';
import { CreateMarketingmanagerDto } from './dto/create-marketingmanager.dto';
import { UpdateMarketingmanagerDto } from './dto/update-marketingmanager.dto';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';

@Injectable()
export class MarketingmanagerService {
  private readonly tableName = 'marketingmanager';
  private readonly logger = new Logger(MarketingmanagerService.name);

  constructor(
    // @Inject('REDIS_CLIENT') 
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}

  async create(
    marketingManagerData: any,
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

      if (marketingManagerData.length === 0) {
        await trx(this.tableName).delete().where('marketing_id', marketing_id);
        return;
      }
 
      const fixData = marketingManagerData.map(
        ({
          managermarketing_nama,
          statusaktifManager_nama,
          ...marketingManagerData
        }) => ({
          ...marketingManagerData,
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

      await trx(tempTableName).insert(openJson);

      const updatedData = await trx(this.tableName) // **Update or Insert into 'marketingmanager' with correct idheader**
        .join(`${tempTableName}`, `${this.tableName}.id`, `${tempTableName}.id`)
        .update({
          marketing_id: trx.raw(`${tempTableName}.marketing_id`),
          managermarketing_id: trx.raw(`${tempTableName}.managermarketing_id`),
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
            'Error inserting data marketing manager in service:',
            error,
            error.message,
          );
          throw error;
        });

      const insertedDataQuery = await trx(tempTableName) // Handle insertion if no update occurs
        .select([
          'marketing_id',
          'managermarketing_id',
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
          'marketingmanager.id',
          `${tempTableName}.id`,
        )
        .select(
          'marketingmanager.id',
          'marketingmanager.marketing_id',
          'marketingmanager.managermarketing_id',
          'marketingmanager.statusaktif',
          'marketingmanager.info',
          'marketingmanager.modifiedby',
          'marketingmanager.created_at',
          'marketingmanager.updated_at',
        )
        .whereNull(`${tempTableName}.id`)
        .where('marketingmanager.marketing_id', marketing_id);

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
          'marketingmanager.id',
          `${tempTableName}.id`,
        )
        .whereNull(`${tempTableName}.id`)
        .where('marketingmanager.marketing_id', marketing_id)
        .del();

      if (insertedDataQuery.length > 0) {
        insertedData = await trx('marketingmanager')
          .insert(insertedDataQuery)
          .returning('*')
          .then((result: any) => result[0])
          .catch((error: any) => {
            console.error(
              'Error inserting data marketing manager in service:',
              error,
            );
            throw error;
          });
      }

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD MARKETING MANAGER FROM MARKETING',
          idtrans: marketing_id,
          nobuktitrans: marketing_id,
          aksi: 'EDIT',
          datajson: JSON.stringify(finalData),
          modifiedby: marketingManagerData[0].modifiedby || 'UNKNOWN',
        },
        trx,
      );

      console.log(
        'return insertedData',
        insertedData,
        'updatedData',
        updatedData,
      );
      return updatedData || insertedData;
    } catch (error) {
      throw new Error(
        `Error inserted marketing manager in service: ${error.message}`,
      );
    }
  }

  async findAll(
    id: string, 
    trx: any,
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
  ) {
    try {
      let { page, limit } = pagination;
      page = page ?? 1;
      limit = limit ?? 0;

      const query = trx(`${this.tableName} as u`)
        .select(
          'u.id',
          'u.marketing_id',
          'u.managermarketing_id',
          trx.raw("FORMAT(u.tglapproval, 'dd-MM-yyyy') as tglapproval"),
          'u.statusapproval',
          'u.userapproval',
          'u.statusaktif',
          'p.nama as marketing_nama',
          'q.nama as managermarketing_nama',
          'statusapproval.text as statusapproval_nama',
          'statusaktif.text as statusaktif_nama',
          'statusaktif.memo',
          'statusapproval.memo as approvalmemo',
        )
        .leftJoin('marketing as p', 'u.marketing_id', 'p.id')
        .leftJoin('managermarketing as q', 'u.managermarketing_id', 'q.id')
        .leftJoin('parameter as statusapproval', 'u.statusapproval', 'statusapproval.id')
        .leftJoin('parameter as statusaktif', 'u.statusaktif', 'statusaktif.id')
        .where('u.marketing_id', id)
        .orderBy('u.created_at', 'desc');

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('p.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('q.nama', 'like', `%${sanitizedValue}%`)
            .orWhereRaw("FORMAT(u.tglapproval, 'dd-MM-yyyy') LIKE ?", [`%${sanitizedValue}%`])
            .orWhere('u.userapproval', 'like', `%${sanitizedValue}%`)
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'statusaktif_nama') {
              query.andWhere(`statusaktif.id`, '=', sanitizedValue);
            } else if (key === 'statusapproval_nama') {
              query.andWhere('statusapproval.id', 'like', `%${sanitizedValue}%`);
            } else if (key === 'marketing_nama') {
              query.andWhere('p.nama', 'like', `%${sanitizedValue}%`);
            } else if (key === 'managermarketing_nama') {
              query.andWhere('q.nama', 'like', `%${sanitizedValue}%`);
            } else if (key === 'tglapproval') {
              query.andWhereRaw("FORMAT(u.tglapproval, 'dd-MM-yyyy') LIKE ?", [`%${sanitizedValue}%`])
            } else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      if (sort?.sortBy && sort?.sortDirection) {
        if (sort?.sortBy === 'managermarketing') {
          query.orderBy('q.nama', sort.sortDirection);
        } else {
          query.orderBy(sort.sortBy, sort.sortDirection);
        }
      }

      const result = await query;

      if (!result.length) {
        this.logger.warn(
          `No data marketing manager found for id marketing_id: ${id}`,
        );

        return {
          status: false,
          message: 'No Data marketing manager Found',
          data: [],
        };
      }

      return {
        status: true,
        message: 'marketing manager data fetched successfully',
        data: result,
      };
    } catch (error) {
      console.error('Error to findAll Marketing Manager', error);
      throw new Error(error);
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} marketingmanager`;
  }

  update(id: number, updateMarketingmanagerDto: UpdateMarketingmanagerDto) {
    return `This action updates a #${id} marketingmanager`;
  }

  remove(id: number) {
    return `This action removes a #${id} marketingmanager`;
  }
}
