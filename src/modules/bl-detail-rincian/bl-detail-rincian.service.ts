import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateBlDetailRincianDto } from './dto/create-bl-detail-rincian.dto';
import { UpdateBlDetailRincianDto } from './dto/update-bl-detail-rincian.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';

@Injectable()
export class BlDetailRincianService {
  private readonly tableName: string = 'bldetailrincian';

  constructor(
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}

  async create(details: any, id: any = 0, trx: any = null) {
    try {
      let insertedData = null;
      const logData: any[] = [];
      const mainDataToInsert: any[] = [];
      const time = this.utilsService.getTime();
      const tempTableName = `##temp_${Math.random().toString(36).substring(2, 15)}`;
      const tableTemp = await this.utilsService.createTempTable(
        this.tableName,
        trx,
        tempTableName,
      );

      if (details.length === 0) {
        await trx(this.tableName).delete().where('bldetail_id', id);
        return;
      }

      for (const data of details) {
        let isDataChanged = false;
        // Check if the data has an id (existing record)
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
          // New record: Set timestamps
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

      // Insert into temp table
      await trx(tempTableName).insert(openJson);

      // **Update or Insert into 'packinglistdetailrincian' with correct idheader**
      const updatedData = await trx(this.tableName)
        .join(`${tempTableName}`, `${this.tableName}.id`, `${tempTableName}.id`)
        .update({
          nobukti: trx.raw(`${tempTableName}.nobukti`),
          bldetail_id: trx.raw(`${tempTableName}.bldetail_id`),
          bldetail_nobukti: trx.raw(`${tempTableName}.bldetail_nobukti`),
          orderanmuatan_nobukti: trx.raw(
            `${tempTableName}.orderanmuatan_nobukti`,
          ),
          keterangan: trx.raw(`${tempTableName}.keterangan`),
          info: trx.raw(`${tempTableName}.info`),
          modifiedby: trx.raw(`${tempTableName}.modifiedby`),
          created_at: trx.raw(`${tempTableName}.created_at`),
          updated_at: trx.raw(`${tempTableName}.updated_at`),
        })
        .returning('*')
        .then((result: any) => result[0])
        .catch((error: any) => {
          console.error('Error updated data bl detail rincian:', error);
          throw error;
        });

      // Handle insertion if no update occurs
      const insertedDataQuery = await trx(tempTableName)
        .select([
          'nobukti',
          'bldetail_id',
          'bldetail_nobukti',
          'orderanmuatan_nobukti',
          'keterangan',
          'info',
          'modifiedby',
          'created_at',
          'updated_at',
        ])
        .where(`${tempTableName}.id`, '0');

      const getDeleted = await trx(`${this.tableName} as u`)
        .leftJoin(`${tempTableName}`, 'u.id', `${tempTableName}.id`)
        .select(
          'u.id',
          'u.nobukti',
          'u.bldetail_id',
          'u.bldetail_nobukti',
          'u.orderanmuatan_nobukti',
          'u.keterangan',
          'u.info',
          'u.modifiedby',
          'u.created_at',
          'u.updated_at',
        )
        .whereNull(`${tempTableName}.id`)
        .where('u.bldetail_id', id);

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
          `${this.tableName}.id`,
          `${tempTableName}.id`,
        )
        .whereNull(`${tempTableName}.id`)
        .where(`${this.tableName}.bldetail_id`, id)
        .del();

      if (insertedDataQuery.length > 0) {
        insertedData = await trx(this.tableName)
          .insert(insertedDataQuery)
          .returning('*')
          .then((result: any) => result[0])
          .catch((error: any) => {
            console.error('Error inserting data bl detail rincian:', error);
            throw error;
          });
      }

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD BL DETAIL RINCIAN',
          idtrans: id,
          nobuktitrans: id,
          aksi: 'EDIT',
          datajson: JSON.stringify(finalData),
          modifiedby: details[0].modifiedby || 'unknown',
        },
        trx,
      );

      console.log(
        'RESULT RINCIAN insertedData',
        insertedData,
        'updatedData',
        updatedData,
      );

      return updatedData || insertedData;
    } catch (error) {
      console.error(
        'Error process creating bl detail rincian in service:',
        error.message,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error process creating bl detail rincian in service',
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
          'u.nobukti',
          'u.bldetail_id',
          'u.bldetail_nobukti',
          'u.orderanmuatan_nobukti',
          'u.keterangan',
          'q.nocontainer',
          'q.noseal',
        )
        .leftJoin('orderanmuatan as q', 'u.orderanmuatan_nobukti', 'q.nobukti')
        .where('bldetail_id', id);

      const excludeSearchKeys = [''];
      const searchFields = Object.keys(filters || {}).filter(
        (k) => !excludeSearchKeys.includes(k),
      );

      if (search) {
        const sanitized = String(search).replace(/\[/g, '[[]').trim();

        query.where((qb) => {
          searchFields.forEach((field) => {
            if (field === 'nocontainer' || field === 'noseal') {
              qb.orWhere(`q.${field}`, 'like', `%${sanitized}%`);
            } else {
              qb.orWhere(`u.${field}`, 'like', `%${sanitized}%`);
            }
          });
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'nocontainer' || key === 'noseal') {
              query.andWhere(`q.${key}`, 'like', `%${sanitizedValue}%`);
            } else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      if (sort?.sortBy && sort?.sortDirection) {
        if (sort?.sortBy === 'nocontainer' || sort?.sortBy === 'noseal') {
          query.orderBy(`q.${sort.sortBy}`, sort.sortDirection);
        } else {
          query.orderBy(sort.sortBy, sort.sortDirection);
        }
      }

      const result = await query;

      return {
        data: result,
      };
    } catch (error) {
      console.error('Error to findAll Bl detail rincian in service', error);
      throw new Error(error);
    }
  }

  async delete(id: number, trx: any, modifiedby: any) {
    try {
      const deletedData = await this.utilsService.lockAndDestroy(
        id,
        this.tableName,
        'id',
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE BL DETAIL RINCIAN',
          idtrans: id,
          nobuktitrans: id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedData),
          modifiedby: modifiedby.toUpperCase(),
        },
        trx,
      );

      return { status: 200, message: 'Data deleted successfully', deletedData };
    } catch (error) {
      console.log('Error deleting data bl detail rincian in service:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to delete data bl detail rincian in service',
      );
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} blDetailRincian`;
  }

  update(id: number, updateBlDetailRincianDto: UpdateBlDetailRincianDto) {
    return `This action updates a #${id} blDetailRincian`;
  }
}
