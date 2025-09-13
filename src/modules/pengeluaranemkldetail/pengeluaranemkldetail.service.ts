import { Injectable, Logger } from '@nestjs/common';
import { CreatePengeluaranemkldetailDto } from './dto/create-pengeluaranemkldetail.dto';
import { UpdatePengeluaranemkldetailDto } from './dto/update-pengeluaranemkldetail.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';

@Injectable()
export class PengeluaranemkldetailService {
  private readonly tableName = 'pengeluaranemkldetail';
  constructor(
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}
  private readonly logger = new Logger(PengeluaranemkldetailService.name);
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
      await trx(this.tableName).delete().where('pengeluaranemkl_id', id);
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
      jurnalumum_id: item.jurnalumum_id ?? id, // Ensure correct field mapping
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

    // **Update or Insert into 'jurnalumumdetail' with correct idheader**
    const updatedData = await trx('pengeluaranemkldetail')
      .join(
        `${tempTableName}`,
        'pengeluaranemkldetail.id',
        `${tempTableName}.id`,
      )
      .update({
        nobukti: trx.raw(`pengeluaranemkldetail.nobukti`),
        tglbukti: trx.raw(`pengeluaranemkldetail.tglbukti`),
        coa: trx.raw(`pengeluaranemkldetail.coa`),
        keterangan: trx.raw(`${tempTableName}.keterangan`),
        nominal: trx.raw(`${tempTableName}.nominal`),
        info: trx.raw(`${tempTableName}.info`),
        modifiedby: trx.raw(`${tempTableName}.modifiedby`),
        pengeluaranemkl_id: trx.raw(`${tempTableName}.pengeluaranemkl_id`),
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
        'tglbukti',
        'coa',
        'keterangan',
        'nominal',
        'info',
        'modifiedby',
        trx.raw('? as pengeluaranemkl_id', [id]),
        'created_at',
        'updated_at',
      ])
      .where(`${tempTableName}.id`, '0');

    const getDeleted = await trx(this.tableName)
      .leftJoin(
        `${tempTableName}`,
        'pengeluaranemkldetail.id',
        `${tempTableName}.id`,
      )
      .select(
        'pengeluaranemkldetail.id',
        'jurnalumumdetail.nobukti',
        'jurnalumumdetail.tglbukti',
        'pengeluaranemkldetail.coa',
        'pengeluaranemkldetail.keterangan',
        'pengeluaranemkldetail.nominal',
        'jurnalumumdetail.info',
        'jurnalumumdetail.modifiedby',
        'jurnalumumdetail.created_at',
        'jurnalumumdetail.updated_at',
        'jurnalumumdetail.jurnalumum_id',
      )
      .whereNull(`${tempTableName}.id`)
      .where('jurnalumumdetail.jurnalumum_id', id);

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
        'jurnalumumdetail.id',
        `${tempTableName}.id`,
      )
      .whereNull(`${tempTableName}.id`)
      .where('jurnalumumdetail.jurnalumum_id', id)
      .del();
    if (insertedDataQuery.length > 0) {
      insertedData = await trx('jurnalumumdetail')
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
        postingdari: 'PENGEMBALIAN KAS GANTUNG HEADER',
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
    try {
      const query = trx
        .from(trx.raw(`${this.tableName} as p WITH (READUNCOMMITTED)`))
        .select(
          'p.id',
          'p.jurnalumum_id',
          trx.raw("FORMAT(p.tglbukti, 'dd-MM-yyyy') as tglbukti"),
          'p.nobukti',
          'p.coa',
          'p.keterangan',
          'ap.keterangancoa as coa_nama',

          // Jika nominal < 0 → nominalkredit = ABS(nominal), selain itu 0
          trx.raw(
            'CASE WHEN p.nominal < 0 THEN ABS(p.nominal) ELSE 0 END AS nominalkredit',
          ),

          // Jika nominal > 0 → nominaldebet = nominal, selain itu 0
          trx.raw(
            'CASE WHEN p.nominal > 0 THEN p.nominal ELSE 0 END AS nominaldebet',
          ),

          trx.raw('ABS(p.nominal) AS nominal'),
          'p.info',
          'p.modifiedby',
          trx.raw("FORMAT(p.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(p.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
        )
        .leftJoin(
          trx.raw('akunpusat as ap WITH (READUNCOMMITTED)'),
          'p.coa',
          'ap.coa',
        )
        .orderBy('p.created_at', 'desc');
      if (filters?.nobukti) {
        query.where('p.nobukti', filters?.nobukti);
      }
      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('p.nobukti', 'like', `%${sanitizedValue}%`)
            .orWhere('p.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('ap.keterangancoa', 'like', `%${sanitizedValue}%`)
            .orWhere('p.coa', 'like', `%${sanitizedValue}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (!value) continue;
          const sanitizedValue = String(value).replace(/\[/g, '[[]');

          switch (key) {
            case 'coa_nama':
              query.andWhere('ap.keterangancoa', 'like', `%${sanitizedValue}%`);
              break;

            case 'tglbukti':
              query.andWhere('p.tglbukti', 'like', sanitizedValue);
              break;

            case 'nominaldebet':
              query.andWhere(
                trx.raw('CASE WHEN p.nominal > 0 THEN p.nominal ELSE 0 END'),
                'like',
                `%${sanitizedValue}%`,
              );
              break;

            case 'nominalkredit':
              query.andWhere(
                trx.raw(
                  'CASE WHEN p.nominal < 0 THEN ABS(p.nominal) ELSE 0 END',
                ),
                'like',
                `%${sanitizedValue}%`,
              );
              break;

            default:
              query.andWhere(`p.${key}`, 'like', `%${sanitizedValue}%`);
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
      console.error('Error in findAll Kas Gantung Detail', error);
      throw new Error(error);
    }
  }
}
