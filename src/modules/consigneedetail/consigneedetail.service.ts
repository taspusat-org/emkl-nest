import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateConsigneedetailDto } from './dto/create-consigneedetail.dto';
import { UpdateConsigneedetailDto } from './dto/update-consigneedetail.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { UtilsService } from 'src/utils/utils.service';

@Injectable()
export class ConsigneedetailService {
  private readonly tableName = 'consigneedetail';
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

    // **Update or Insert into 'consigneedetail' with correct idheader**
    const updatedData = await trx('consigneedetail')
      .join(`${tempTableName}`, 'consigneedetail.id', `${tempTableName}.id`)
      .update({
        keterangan: trx.raw(`${tempTableName}.keterangan`),
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
        'keterangan',
        'info',
        'modifiedby',
        trx.raw('? as consignee_id', [id]),
        'created_at',
        'updated_at',
      ])
      .where(`${tempTableName}.id`, '0');

    const getDeleted = await trx(this.tableName)
      .leftJoin(`${tempTableName}`, 'consigneedetail.id', `${tempTableName}.id`)
      .select(
        'consigneedetail.id',
        'consigneedetail.keterangan',
        'consigneedetail.info',
        'consigneedetail.modifiedby',
        'consigneedetail.created_at',
        'consigneedetail.updated_at',
        'consigneedetail.consignee_id',
      )
      .whereNull(`${tempTableName}.id`)
      .where('consigneedetail.consignee_id', id);

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
      .leftJoin(`${tempTableName}`, 'consigneedetail.id', `${tempTableName}.id`)
      .whereNull(`${tempTableName}.id`)
      .where('consigneedetail.consignee_id', id)
      .del();
    if (insertedDataQuery.length > 0) {
      insertedData = await trx('consigneedetail')
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
        postingdari: 'CONSIGNEE DETAIL',
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
            `${this.tableName} as consigneedetail WITH (READUNCOMMITTED)`,
          ),
        )
        .select(
          'consigneedetail.id',
          'consigneedetail.consignee_id',
          'consigneedetail.keterangan',
          'consigneedetail.info',
          'consigneedetail.modifiedby',
          trx.raw(
            "FORMAT(consigneedetail.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at",
          ),
          trx.raw(
            "FORMAT(consigneedetail.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at",
          ),
        )
        .orderBy('consigneedetail.created_at', 'desc');

      if (filters?.consignee_id) {
        query.where('consigneedetail.consignee_id', filters?.consignee_id);
      }
      const excludeSearchKeys = ['consignee_id'];
      const searchFields = Object.keys(filters || {}).filter(
        (k) => !excludeSearchKeys.includes(k) && filters![k],
      );
      if (search) {
        const sanitized = String(search).replace(/\[/g, '[[]').trim();

        query.where((qb) => {
          searchFields.forEach((field) => {
            qb.orWhere(`consigneedetail.${field}`, 'like', `%${sanitized}%`);
          });
        });
      }
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (key === 'consignee_id') {
            continue;
          }
          if (!value) continue;
          const sanitizedValue = String(value).replace(/\[/g, '[[]');

          switch (key) {
            case 'bongkarke':
              query.andWhere(
                'consigneedetail.bongkarke',
                'like',
                `%${sanitizedValue}%`,
              );
              break;

            default:
              query.andWhere(
                `consigneedetail.${key}`,
                'like',
                `%${sanitizedValue}%`,
              );
          }
        }
      }

      if (sort?.sortBy && sort?.sortDirection) {
        query.orderBy(sort.sortBy, sort.sortDirection);
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
      let deletedData: any = [];
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
          postingdari: 'DELETE CONSIGNEE DETAIL',
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
    return `This action returns a #${id} consigneedetail`;
  }

  update(id: number, updateConsigneedetailDto: UpdateConsigneedetailDto) {
    return `This action updates a #${id} consigneedetail`;
  }

  remove(id: number) {
    return `This action removes a #${id} consigneedetail`;
  }
}
