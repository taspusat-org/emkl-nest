import { Injectable, Logger } from '@nestjs/common';
import { CreateKasgantungdetailDto } from './dto/create-kasgantungdetail.dto';
import { UpdateKasgantungdetailDto } from './dto/update-kasgantungdetail.dto';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';

@Injectable()
export class KasgantungdetailService {
  private readonly tableName = 'kasgantungdetail';
  constructor(
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}
  private readonly logger = new Logger(KasgantungdetailService.name);
  async create(details: any, id: any = 0, trx: any = null) {
    let insertedData = null;
    let data: any = null;
    const tableName = 'pengembaliankasgantungdetail'; // Adjusted table name
    const tempTableName = `##temp_${Math.random().toString(36).substring(2, 15)}`;

    // Get the column info and create temporary table
    const result = await trx(tableName).columnInfo();
    const tableTemp = await this.utilsService.createTempTable(
      tableName,
      trx,
      tempTableName,
    );

    const time = this.utilsService.getTime();
    const logData: any[] = [];
    const mainDataToInsert: any[] = [];
    console.log(details);
    if (details.length === 0) {
      await trx(tableName).delete().where('pengembaliankasgantung_id', id);
      return;
    }
    for (data of details) {
      let isDataChanged = false;
      // Check if the data has an id (existing record)
      if (data.id) {
        const existingData = await trx(tableName).where('id', data.id).first();

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
    console.log('mainDataToInsert', mainDataToInsert);
    // Ensure each item has an idheader
    const processedData = mainDataToInsert.map((item: any) => ({
      ...item,
      pengembaliankasgantung_id: item.pengembaliankasgantung_id ?? id, // Ensure correct field mapping
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
    console.log('table', await trx(tempTableName));

    // **Update or Insert into 'pengembaliankasgantungdetail' with correct idheader**
    const updatedData = await trx('pengembaliankasgantungdetail')
      .join(
        `${tempTableName}`,
        'pengembaliankasgantungdetail.id',
        `${tempTableName}.id`,
      )
      .update({
        nobukti: trx.raw(`${tempTableName}.nobukti`),
        kasgantung_nobukti: trx.raw(`${tempTableName}.kasgantung_nobukti`),
        keterangan: trx.raw(`${tempTableName}.keterangan`),
        nominal: trx.raw(`${tempTableName}.nominal`),
        info: trx.raw(`${tempTableName}.info`),
        modifiedby: trx.raw(`${tempTableName}.modifiedby`),
        editing_by: trx.raw(`${tempTableName}.editing_by`),
        editing_at: trx.raw(`${tempTableName}.editing_at`),
        pengembaliankasgantung_id: trx.raw(
          `${tempTableName}.pengembaliankasgantung_id`,
        ),
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
        'nobukti',
        'kasgantung_nobukti',
        'keterangan',
        'nominal',
        'info',
        'modifiedby',
        'editing_by',
        'editing_at',
        trx.raw('? as pengembaliankasgantung_id', [id]),
        'created_at',
        'updated_at',
      ])
      .where(`${tempTableName}.id`, '0');

    const getDeleted = await trx(tableName)
      .leftJoin(
        `${tempTableName}`,
        'pengembaliankasgantungdetail.id',
        `${tempTableName}.id`,
      )
      .select(
        'pengembaliankasgantungdetail.id',
        'pengembaliankasgantungdetail.nobukti',
        'pengembaliankasgantungdetail.kasgantung_nobukti',
        'pengembaliankasgantungdetail.keterangan',
        'pengembaliankasgantungdetail.nominal',
        'pengembaliankasgantungdetail.info',
        'pengembaliankasgantungdetail.modifiedby',
        'pengembaliankasgantungdetail.editing_by',
        'pengembaliankasgantungdetail.editing_at',
        'pengembaliankasgantungdetail.created_at',
        'pengembaliankasgantungdetail.updated_at',
        'pengembaliankasgantungdetail.pengembaliankasgantung_id',
      )
      .whereNull(`${tempTableName}.id`)
      .where('pengembaliankasgantungdetail.pengembaliankasgantung_id', id);

    let pushToLog: any[] = [];

    if (getDeleted.length > 0) {
      pushToLog = Object.assign(getDeleted, { aksi: 'DELETE' });
    }

    const pushToLogWithAction = pushToLog.map((entry) => ({
      ...entry,
      aksi: 'DELETE',
    }));

    const finalData = logData.concat(pushToLogWithAction);

    const deletedData = await trx(tableName)
      .leftJoin(
        `${tempTableName}`,
        'pengembaliankasgantungdetail.id',
        `${tempTableName}.id`,
      )
      .whereNull(`${tempTableName}.id`)
      .where('pengembaliankasgantungdetail.pengembaliankasgantung_id', id)
      .del();
    if (insertedDataQuery.length > 0) {
      insertedData = await trx('pengembaliankasgantungdetail')
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
        namatabel: tableName,
        postingdari: 'PENGEMBALIAN KAS GANTUNG HEADER',
        idtrans: id,
        nobuktitrans: id,
        aksi: 'EDIT',
        datajson: JSON.stringify(finalData),
        modifiedby: 'admin',
      },
      trx,
    );

    return updatedData || insertedData;
  }

  async findAll(id: number, trx: any) {
    const result = await trx(`${this.tableName} as p`)
      .select(
        'p.id',
        'p.kasgantung_id', // Updated field name
        'p.nobukti',
        'p.keterangan',
        'p.nominal', // Updated field name
        'p.info',
        'p.modifiedby',
        'p.editing_by',
        trx.raw("FORMAT(p.editing_at, 'dd-MM-yyyy HH:mm:ss') as editing_at"),
        trx.raw("FORMAT(p.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
        trx.raw("FORMAT(p.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
      )
      .where('p.kasgantung_id', id) // Updated field name
      .orderBy('p.created_at', 'desc'); // Optional: Order by creation date

    if (!result.length) {
      this.logger.warn(`No Data found for ID: ${id}`);
      return {
        status: false,
        message: 'No data found',
        data: [],
      };
    }

    return {
      status: true,
      message: 'Kas Gantung Detail data fetched successfully',
      data: result,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} kasgantungdetail`;
  }

  update(id: number, updateKasgantungdetailDto: UpdateKasgantungdetailDto) {
    return `This action updates a #${id} kasgantungdetail`;
  }

  remove(id: number) {
    return `This action removes a #${id} kasgantungdetail`;
  }
}
