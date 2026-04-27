import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateConsigneehargajualDto } from './dto/create-consigneehargajual.dto';
import { UpdateConsigneehargajualDto } from './dto/update-consigneehargajual.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';

@Injectable()
export class ConsigneehargajualService {
  private readonly tableName = 'consigneehargajual';
  constructor(
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}
  async create(details: any, id: any = 0, trx: any = null) {
    let insertedData = null;
    let data: any = null;
    const tempTableName = `##temp_${Math.random().toString(36).substring(2, 15)}`;

    // Get the column info and create temporary table
    const result = await trx(this.tableName).columnInfo();
    const tableTemp = await this.utilsService.createTempTable(
      this.tableName,
      trx,
      tempTableName,
    );

    const time = this.utilsService.getTime();
    const logData: any[] = [];
    const mainDataToInsert: any[] = [];
    if (details.length === 0) {
      await trx(this.tableName).delete().where('consignee_id', id);
      return;
    }
    for (data of details) {
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

    // Create temporary table to insert
    await trx.raw(tableTemp);
    // Ensure each item has an idheader
    const processedData = mainDataToInsert.map((item: any) => ({
      ...item,
      consignee_id: item.consignee_id ?? id, // Ensure correct field mapping
    }));
    const jsonString = JSON.stringify(processedData);

    const mappingData = Object.keys(processedData[0]).map((key) => [
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

    // **Update or Insert into 'consigneehargajual' with correct idheader**
    const updatedData = await trx('consigneehargajual')
      .join(`${tempTableName}`, 'consigneehargajual.id', `${tempTableName}.id`)
      .update({
        container_id: trx.raw(`${tempTableName}.container_id`),
        nominal: trx.raw(`${tempTableName}.nominal`),
        info: trx.raw(`${tempTableName}.info`),
        modifiedby: trx.raw(`${tempTableName}.modifiedby`),
        consignee_id: trx.raw(`${tempTableName}.consignee_id`),
        created_at: trx.raw(`${tempTableName}.created_at`),
        updated_at: trx.raw(`${tempTableName}.updated_at`),
      })
      .returning('*')
      .then((result: any) => result[0])
      .catch((error: any) => {
        console.error('Error inserting data:', error);
        throw error;
      });

    // Handle insertion if no update occurs
    const insertedDataQuery = await trx(tempTableName)
      .select([
        'container_id',
        'nominal',
        'info',
        'modifiedby',
        trx.raw('? as consignee_id', [id]),
        'created_at',
        'updated_at',
      ])
      .where(`${tempTableName}.id`, '0');

    const getDeleted = await trx(this.tableName)
      .leftJoin(
        `${tempTableName}`,
        'consigneehargajual.id',
        `${tempTableName}.id`,
      )
      .select(
        'consigneehargajual.id',
        'consigneehargajual.container_id',
        'consigneehargajual.nominal',
        'consigneehargajual.info',
        'consigneehargajual.modifiedby',
        'consigneehargajual.created_at',
        'consigneehargajual.updated_at',
        'consigneehargajual.consignee_id',
      )
      .whereNull(`${tempTableName}.id`)
      .where('consigneehargajual.consignee_id', id);

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
        'consigneehargajual.id',
        `${tempTableName}.id`,
      )
      .whereNull(`${tempTableName}.id`)
      .where('consigneehargajual.consignee_id', id)
      .del();
    if (insertedDataQuery.length > 0) {
      insertedData = await trx('consigneehargajual')
        .insert(insertedDataQuery)
        .returning('*')
        .then((result: any) => result[0])
        .catch((error: any) => {
          console.error('Error inserting data:', error);
          throw error;
        });
    }

    await this.logTrailService.create(
      {
        namatabel: this.tableName,
        postingdari: 'CONSIGNEE HARGA JUAL',
        idtrans: id,
        nobuktitrans: id,
        aksi: 'EDIT',
        datajson: JSON.stringify(finalData),
        modifiedby: details[0].modifiedby || 'unknown',
      },
      trx,
    );

    return updatedData || insertedData;
  }

  async findAll({ search, filters, sort }: FindAllParams, trx: any) {
    if (!filters?.consignee_id) {
      return {
        data: [],
      };
    }
    try {
      if (!filters?.consignee_id) {
        return {
          status: true,
          message: 'Jurnal umum Detail failed to fetch',
          data: [],
        };
      }
      const query = trx
        .from(
          trx.raw(
            `${this.tableName} as consigneehargajual WITH (READUNCOMMITTED)`,
          ),
        )
        .select(
          'consigneehargajual.id',
          'consigneehargajual.consignee_id',
          'consigneehargajual.container_id',
          'consigneehargajual.nominal',

          'consigneehargajual.info',
          'consigneehargajual.modifiedby',
          'p1.nama as container_nama',
          trx.raw(
            "FORMAT(consigneehargajual.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at",
          ),
          trx.raw(
            "FORMAT(consigneehargajual.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at",
          ),
        )
        .leftJoin('container as p1', 'consigneehargajual.container_id', 'p1.id')
        .orderBy('consigneehargajual.created_at', 'desc');

      if (filters?.consignee_id) {
        query.where('consigneehargajual.consignee_id', filters?.consignee_id);
      }
      const excludeSearchKeys = ['consignee_id'];
      const searchFields = Object.keys(filters || {}).filter(
        (k) => !excludeSearchKeys.includes(k) && filters![k],
      );
      if (search) {
        const sanitized = String(search).replace(/\[/g, '[[]').trim();

        query.where((qb) => {
          searchFields.forEach((field) => {
            if (['created_at', 'updated_at'].includes(field)) {
              qb.orWhereRaw(
                "FORMAT(consigneehargajual.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?",
                [field, `%${sanitized}%`],
              );
            } else if (field === 'container_nama') {
              qb.orWhere('p1.nama', 'like', `%${sanitized}%`);
            } else {
              qb.orWhere(
                `consigneehargajual.${field}`,
                'like',
                `%${sanitized}%`,
              );
            }
          });
        });
      }
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');

          if (value) {
            if (key === 'created_at' || key === 'updated_at') {
              query.andWhereRaw(
                "FORMAT(consigneehargajual.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?",
                [key, `%${sanitizedValue}%`],
              );
            } else if (key === 'container_nama') {
              query.andWhere('p1.nama', 'like', `%${sanitizedValue}%`);
            } else {
              query.andWhere(
                `consigneehargajual.${key}`,
                'like',
                `%${sanitizedValue}%`,
              );
            }
          }
        }
      }

      if (sort?.sortBy && sort?.sortDirection) {
        if (sort.sortBy === 'container_nama') {
          query.orderBy('p1.nama', sort.sortDirection);
        } else {
          query.orderBy(sort.sortBy, sort.sortDirection);
        }
      }
      const result = await query;
      return {
        data: result,
      };
    } catch (error) {
      console.error('Error in findAll Consignee Detail', error);
      throw new Error(error);
    }
  }

  async delete(id: number, trx: any, modifiedby: string) {
    try {
      const dataDetail = await trx(this.tableName).where('consignee_id', id);

      if (dataDetail.length === 0) {
        return {
          status: 200,
          message: 'Data not found',
          data: [],
        };
      }
      const deletedData: any = [];
      for (const item of dataDetail) {
        const deletedDataItem = await this.utilsService.lockAndDestroy(
          item.id,
          this.tableName,
          'id',
          trx,
        );
        deletedData.push(deletedDataItem);
      }

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE CONSIGNEE HARGA JUAL',
          idtrans: deletedData.id,
          nobuktitrans: deletedData.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedData),
          modifiedby: modifiedby,
        },
        trx,
      );

      return { status: 200, message: 'Data deleted successfully', deletedData };
    } catch (error) {
      console.log('Error deleting data:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete data');
    }
  }
  findOne(id: number) {
    return `This action returns a #${id} consigneehargajual`;
  }

  update(id: number, updateConsigneehargajualDto: UpdateConsigneehargajualDto) {
    return `This action updates a #${id} consigneehargajual`;
  }

  remove(id: number) {
    return `This action removes a #${id} consigneehargajual`;
  }
}
