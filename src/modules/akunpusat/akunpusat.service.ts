import { Inject, Injectable } from '@nestjs/common';
import { CreateAkunpusatDto } from './dto/create-akunpusat.dto';
import { UpdateAkunpusatDto } from './dto/update-akunpusat.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { UtilsService } from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import { PengembaliankasgantungdetailService } from '../pengembaliankasgantungdetail/pengembaliankasgantungdetail.service';

@Injectable()
export class AkunpusatService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
  ) {}
  private readonly tableName = 'akunpusat';
  async create(createMenuDto: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        parent_nama,
        acos_nama,
        statusaktif_nama,
        ...insertData
      } = createMenuDto;
      insertData.updated_at = this.utilsService.getTime();
      insertData.created_at = this.utilsService.getTime();
      // Normalize the data (e.g., convert strings to uppercase)
      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });

      // Insert the new item
      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      const newItem = insertedItems[0]; // Get the inserted item

      // Now use findAll to get the updated list with pagination, sorting, and filters
      const { data, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit },
          sort: { sortBy, sortDirection },
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );
      let itemIndex = data.findIndex((item) => item.id === newItem.id);
      if (itemIndex === -1) {
        itemIndex = 0;
      }

      // Optionally, you can find the page number or other info if needed
      const pageNumber = pagination?.currentPage;

      // Optionally, you can log the event or store the new item in a cache if needed
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(data),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD AKUN PUSAT',
          idtrans: newItem.id,
          nobuktitrans: newItem.id,
          aksi: 'ADD',
          datajson: JSON.stringify(newItem),
          modifiedby: newItem.modifiedby,
        },
        trx,
      );

      return {
        newItem,
        pageNumber,
        itemIndex,
      };
    } catch (error) {
      throw new Error(`Error creating parameter: ${error.message}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      // Use default empty object if filters is undefined
      filters = filters ?? {};

      let { page, limit } = pagination;

      page = page ?? 1;
      limit = limit ?? 0;

      const excludedFields = [
        'created_at',
        'updated_at',
        'editing_at',
        'modifiedby',
        'editing_by', // List of fields to be excluded from search and filter
        // Add more fields that you want to exclude here
      ];

      if (isLookUp) {
        const acoCountResult = await trx(this.tableName)
          .count('id as total')
          .first();

        const acoCount = acoCountResult?.total || 0;

        if (Number(acoCount) > 500) {
          return { data: { type: 'json' } };
        } else {
          limit = 0;
        }
      }

      const query = trx(`${this.tableName} as u`)
        .select([
          'u.id as id',
          'u.type_id as type_id', // type_id (integer)
          'u.level as level', // level (integer)
          'u.coa as coa', // coa (nvarchar(100))
          'u.keterangancoa as keterangancoa', // keterangancoa (nvarchar(max))
          'u.parent as parent', // parent (nvarchar(100))
          'u.statusap as statusap', // statusap (group status nilai)
          'u.statuslabarugi as statuslabarugi', // statuslabarugi (group status nilai)
          'u.statusneraca as statusneraca', // statusneraca (group status nilai)
          'u.statuslabarugiberjalan as statuslabarugiberjalan', // statuslabarugiberjalan (group status nilai)
          'u.statusbiaya as statusbiaya', // statusbiaya (group status nilai)
          'u.statushutang as statushutang', // statushutang (group status nilai)
          'u.statuspiutang as statuspiutang', // statuspiutang (group status nilai)
          'u.statusterimakasbank as statusterimakasbank', // statusterimakasbank (group status nilai)
          'u.statuskeluarkasbank as statuskeluarkasbank', // statuskeluarkasbank (group status nilai)
          'u.statusadjhutang as statusadjhutang', // statusadjhutang (group status nilai)
          'u.statusadjpiutang as statusadjpiutang', // statusadjpiutang (group status nilai)
          'u.statuspinjaman as statuspinjaman', // statuspinjaman (group status nilai)
          'u.statuskasgantung as statuskasgantung', // statuskasgantung (group status nilai)
          'u.cabang_id as cabang_id', // cabang_id (integer)
          'c.nama as cabang_nama', // cabang_id (integer)
          'p1.text as statusap_nama', // statusap name
          'p2.text as statuslabarugi_nama', // statuslabarugi name
          'p3.text as statusneraca_nama', // statusneraca name
          'p4.text as statuslabarugiberjalan_nama', // statuslabarugiberjalan name
          'p5.text as statusbiaya_nama', // statusbiaya name
          'p6.text as statushutang_nama', // statushutang name
          'p7.text as statuspiutang_nama', // statuspiutang name
          'p8.text as statusterimakasbank_nama', // statusterimakasbank name
          'p9.text as statuskeluarkasbank_nama', // statuskeluarkasbank name
          'p10.text as statusadjhutang_nama', // statusadjhutang name
          'p11.text as statusadjpiutang_nama', // statusadjpiutang name
          'p12.text as statuspinjaman_nama', // statuspinjaman name
          'p13.text as statuskasgantung_nama', // statuskasgantung name
          'u.statusaktif as statusaktif', // statusaktif (group status aktif)
          'u.info as info', // info (nvarchar(max))
          'u.modifiedby as modifiedby', // modifiedby (varchar(200))
          'u.editing_by as editing_by', // editing_by (varchar(200))
          'u.editing_at as editing_at', // editing_at (datetime)
          'u.created_at as created_at', // created_at (datetime)
          'u.updated_at as updated_at', // updated_at (datetime)
        ])
        .leftJoin('parameter as p1', 'u.statusap', 'p1.id')
        .leftJoin('parameter as p2', 'u.statuslabarugi', 'p2.id')
        .leftJoin('parameter as p3', 'u.statusneraca', 'p3.id')
        .leftJoin('parameter as p4', 'u.statuslabarugiberjalan', 'p4.id')
        .leftJoin('parameter as p5', 'u.statusbiaya', 'p5.id')
        .leftJoin('parameter as p6', 'u.statushutang', 'p6.id')
        .leftJoin('parameter as p7', 'u.statuspiutang', 'p7.id')
        .leftJoin('parameter as p8', 'u.statusterimakasbank', 'p8.id')
        .leftJoin('parameter as p9', 'u.statuskeluarkasbank', 'p9.id')
        .leftJoin('parameter as p10', 'u.statusadjhutang', 'p10.id')
        .leftJoin('parameter as p11', 'u.statusadjpiutang', 'p11.id')
        .leftJoin('parameter as p12', 'u.statuspinjaman', 'p12.id')
        .leftJoin('parameter as p13', 'u.statuskasgantung', 'p13.id')
        .leftJoin('cabang as c', 'u.cabang_id', 'c.id');

      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        // Use keys from filters for dynamic search conditions, excluding the ones in the excludedFields list
        const filterKeys = Object.keys(filters).filter(
          (key) => !excludedFields.includes(key),
        );
        query.where((builder) => {
          filterKeys.forEach((key) => {
            builder.orWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
          });
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          const sanitizedValue = String(value).replace(/\[/g, '[[]');
          // Skip filtering on excluded fields
          if (excludedFields.includes(key)) continue;

          if (value) {
            if (
              key === 'created_at' ||
              key === 'updated_at' ||
              key === 'editing_at'
            ) {
              query.andWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
                key,
                `%${sanitizedValue}%`,
              ]);
            } else {
              query.andWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
            }
          }
        }
      }

      const result = await trx(this.tableName).count('id as total').first();
      const total = result?.total as number;
      const totalPages = Math.ceil(total / limit);

      if (sort?.sortBy && sort?.sortDirection) {
        query.orderBy(sort.sortBy, sort.sortDirection);
      }

      const data = await query;

      const responseType = Number(total) > 500 ? 'json' : 'local';

      return {
        data: data,
        type: responseType,
        total,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      console.error('Error fetching data:', error);
      throw new Error('Failed to fetch data');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} akunpusat`;
  }

  update(id: number, updateAkunpusatDto: UpdateAkunpusatDto) {
    return `This action updates a #${id} akunpusat`;
  }

  remove(id: number) {
    return `This action removes a #${id} akunpusat`;
  }
}
