import { Inject, Injectable } from '@nestjs/common';
import { CreateScheduleKapalDto } from './dto/create-schedule-kapal.dto';
// import { UpdateScheduleKapalDto } from './dto/update-schedule-kapal.dto';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';
import { GlobalService } from '../global/global.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';

@Injectable()
export class ScheduleKapalService {
  private readonly tableName: string = 'schedulekapal';

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly utilService: UtilsService,
    // private readonly locksService:
    private readonly redisService: RedisService,
    private readonly globalService: GlobalService,
    private readonly logTrailService: LogtrailService,
  ) {}

  async create(createData: any, trx: any) {
    try {
      console.log('masuk ke create sc kapal', createData);

      Object.keys(createData).forEach((key) => {
        if (typeof createData[key] === 'string') {
          // createData[key] = createData[key].toUpperCase();

          const value = createData[key];
          const dateRegex = /^\d{2}-\d{2}-\d{4}$/;

          if (dateRegex.test(value)) {
            createData[key] = formatDateToSQL(value);
          } else {
            createData[key] = createData[key].toUpperCase();
          }
        }
      });

      const insertedItems = await trx(this.tableName)
        .insert(createData)
        .returning('*');

      const newData = insertedItems[0];

      await this.logTrailService.create(
        {
          namatable: this.tableName,
          postingdari: 'ADD SCHEDULE KAPAL',
          idtrans: newData.id,
          nobuktitrans: newData.id,
          aksi: 'ADD',
          datajson: JSON.stringify(newData),
          modifiedby: newData.modifiedby,
        },
        trx,
      );

      return {
        newData: newData,
      };
    } catch (error) {
      throw new Error(
        `Error creating schedule kapal in service be: ${error.message}`,
      );
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      let { page, limit } = pagination;
      page = page ?? 1;
      limit = limit ?? 0;
      // console.log('kesini?', search, filters, page, limit, sort);

      const query = trx(`${this.tableName} as u`)
      .select([
        'u.id',
        'u.jenisorderan_id',
        'u.voyberangkat',
        'u.keterangan',
        'u.kapal_id',
        'u.pelayaran_id',
        'u.tujuankapal_id',
        'u.asalkapal_id',
        trx.raw("FORMAT(u.tglberangkat, 'dd-MM-yyyy') as tglberangkat"),
        trx.raw("FORMAT(u.tgltiba, 'dd-MM-yyyy') as tgltiba"),
        // 'u.tglclosing',
        trx.raw("FORMAT(u.tglclosing, 'dd-MM-yyyy HH:mm:ss') as tglclosing"),
        'u.statusberangkatkapal',
        'u.statustibakapal',
        'u.batasmuatankapal',
        'u.statusaktif',
        'u.modifiedby',
        trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
        trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
        'a.nama as jenisorderan_nama',
        'b.nama as kapal_nama',
        'c.nama as pelayaran_nama',
        'd.nama as tujuankapal_nama',
        'e.keterangan as asalkapal_nama',
        'p.memo',
        'p.text as statusaktif_nama'
      ])
      .leftJoin('jenisorderan as a', 'u.jenisorderan_id', 'a.id')
      .leftJoin('kapal as b', 'u.kapal_id', 'b.id')
      .leftJoin('pelayaran as c', 'u.pelayaran_id', 'c.id')
      .leftJoin('tujuankapal as d', 'u.tujuankapal_id', 'd.id')
      .leftJoin('asalkapal as e', 'u.asalkapal_id', 'e.id')
      .leftJoin('parameter as p', 'u.statusaktif', 'p.id')

      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      if (search) {
        console.log('atau kesini ');

        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('a.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('u.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('b.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('c.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('d.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('e.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('u.voyberangkat', 'like', `%${sanitizedValue}%`)
            .orWhere('u.tglberangkat', 'like', `%${sanitizedValue}%`)
            .orWhere('u.tgltiba', 'like', `%${sanitizedValue}%`)
            .orWhere('u.tglclosing', 'like', `%${sanitizedValue}%`)
            .orWhere('u.statusberangkatkapal', 'like', `%${sanitizedValue}%`)
            .orWhere('u.statustibakapal', 'like', `%${sanitizedValue}%`)
            .orWhere('u.batasmuatankapal', 'like', `%${sanitizedValue}%`)
            .orWhere('p.text', 'like', `%${sanitizedValue}%`)
            .orWhere('u.modifiedby', 'like', `%${sanitizedValue}%`)
            .orWhere('u.created_at', 'like', `%${sanitizedValue}%`)
            .orWhere('u.updated_at', 'like', `%${sanitizedValue}%`);
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          if (value) {
            if (key === 'created_at' || key === 'updated_at') {
              query.andWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
                key,
                `%${sanitizedValue}%`,
              ]);
            } else if (key === 'statusaktif_nama' || key === 'memo') {
              query.andWhere(`p.text`, '=', sanitizedValue);
            } else if (key === 'jenisorderan_nama') {
              query.andWhere(`a.nama`, 'like', `%${sanitizedValue}%`);
            } else if (key === 'kapal_nama') {
              query.andWhere(`b.nama`, 'like', `%${sanitizedValue}%`);
            } else if (key === 'pelayaran_nama') {
              query.andWhere(`c.nama`, 'like', `%${sanitizedValue}%`);
            } else if (key === 'tujuankapal_nama') {
              query.andWhere(`d.nama`, 'like', `%${sanitizedValue}%`);
            } else if (key === 'asalkapal_nama') {
              query.andWhere(`e.keterangan`, 'like', `%${sanitizedValue}%`);
            } else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      const result = await trx(this.tableName).count('id as total').first();
      const total = result?.total as number;
      // const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
      const totalPages = Math.ceil(total / limit);

      if (sort?.sortBy && sort?.sortDirection) {
        if (sort?.sortBy === 'jenisorderan') {
          query.orderBy('a.nama', sort?.sortDirection);
        } else if (sort?.sortBy === 'kapal') {
          query.orderBy('b.nama', sort?.sortDirection);
        } else if (sort?.sortBy === 'pelayaran') {
          query.orderBy('c.nama', sort?.sortDirection);
        } else if (sort?.sortBy === 'tujuankapal') {
          query.orderBy('d.nama', sort?.sortDirection);
        } else if (sort?.sortBy === 'asalkapal') {
          query.orderBy('e.keterangan', sort?.sortDirection);
        } else {
          query.orderBy(sort.sortBy, sort.sortDirection);
        }
      }

      const data = await query;

      return {
        data: data,
        total,
        pagination: {
          currentPage: Number(page),
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: limit > 0 ? limit : total,
        },
      };
    } catch (error) {
      console.error('Error to findAll Schedule Kapal in Service', error);
      throw new Error(error);
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} scheduleKapal`;
  }

  update(id: number, updateScheduleKapalDto: any) {
    return `This action updates a #${id} scheduleKapal`;
  }

  remove(id: number) {
    return `This action removes a #${id} scheduleKapal`;
  }
}
