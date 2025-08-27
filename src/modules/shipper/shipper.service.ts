import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateShipperDto } from './dto/create-shipper.dto';
import { UpdateShipperDto } from './dto/update-shipper.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';
@Injectable()
export class ShipperService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}
  private readonly tableName = 'shipper';
  create(createShipperDto: CreateShipperDto) {
    return 'This action adds a new shipper';
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      // default pagination
      let { page, limit } = pagination;

      page = page ?? 1;
      limit = limit ?? 0;

      // lookup mode: jika total > 500, kirim json saja
      if (isLookUp) {
        const countResult = await trx(this.tableName)
          .count('id as total')
          .first();
        const totalCount = Number(countResult?.total) || 0;
        if (totalCount > 500) {
          return { data: { type: 'json' } };
        }
        limit = 0;
      }

      // build query
      const query = trx(`${this.tableName} as b`)
        .select([
          'b.id',
          'b.statusrelasi',
          'b.relasi_id',
          'b.nama',
          'b.keterangan',
          'b.contactperson',
          'b.alamat ',
          'b.coa ',
          'b.coapiutang',
          'b.coahutang',
          'b.kota',
          'b.kodepos',
          'b.telp',
          'b.email',
          'b.fax',
          'b.web',
          'b.creditlimit',
          'b.creditterm',
          'b.credittermplus',
          'b.npwp',
          'b.coagiro',
          'b.ppn',
          'b.titipke',
          'b.ppnbatalmuat',
          'b.grup',
          'b.formatdeliveryreport',
          'b.comodity',
          'b.namashippercetak',
          'b.formatcetak',
          'b.marketing_id',
          'b.blok',
          'b.nomor',
          'b.rt',
          'b.rw',
          'b.kelurahan',
          'b.kabupaten',
          'b.kecamatan',
          'b.propinsi',
          'b.isdpp10psn',
          'b.usertracing',
          'b.passwordtracing',
          'b.kodeprospek',
          'b.namashipperprospek',
          'b.emaildelay',
          'b.keterangan1barisinvoice',
          'b.nik',
          'b.namaparaf',
          'b.saldopiutang',
          'b.keteranganshipperjobminus',
          'b.tglemailshipperjobminus',
          'b.tgllahir',
          'b.tglinput',
          'b.idshipperasal',
          'b.initial',
          'b.tipe',
          'b.nshipper2',
          'b.idtipe',
          'b.idinitial',
          'b.nshipperprospek',
          'b.parentshipper_id',
          'b.npwpnik',
          'b.nitku',
          'b.kodepajak',
          'b.statusaktif',
          'b.info',
          'b.modifiedby',
          trx.raw("FORMAT(b.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(b.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'p.memo',
          'p.text',
          'q.keterangancoa as coa_text',
          'q2.keterangancoa as coapiutang_text',
          'q3.keterangancoa as coahutang_text',
          'q4.keterangancoa as coagiro_text',
          's.nama as shipperasal_text',
          'm.nama as marketing_text',
        ])
        .leftJoin('parameter as p', 'b.statusaktif', 'p.id')
        .leftJoin('akunpusat as q', 'b.coa', 'q.id')
        .leftJoin('akunpusat as q2', 'b.coapiutang', 'q2.id')
        .leftJoin('akunpusat as q3', 'b.coahutang', 'q3.id')
        .leftJoin('akunpusat as q4', 'b.coagiro', 'q4.id')
        .leftJoin('shipper as s', 'b.idshipperasal', 's.id')
        .leftJoin('marketing as m', 'b.marketing_id', 'm.id');

      if (filters?.tglDari && filters?.tglSampai) {
        // Mengonversi tglDari dan tglSampai ke format yang diterima SQL (YYYY-MM-DD)
        const tglDariFormatted = formatDateToSQL(String(filters?.tglDari)); // Fungsi untuk format
        const tglSampaiFormatted = formatDateToSQL(String(filters?.tglSampai));

        // Menggunakan whereBetween dengan tanggal yang sudah diformat
        query.whereBetween('b.created_at', [
          tglDariFormatted,
          tglSampaiFormatted,
        ]);
      }
      if (search) {
        const val = `%${String(search).replace(/\[/g, '[[]')}%`;

        query.where((builder) => {
          query.forEach((col) => {
            if (typeof col === 'string' && col.startsWith('b.')) {
              builder.orWhere(col, 'like', val);
            }
          });
        });
      }

      if (filters?.id) {
        query.andWhere('b.id', filters.id);
      }

      if (filters?.tglDari && filters?.tglSampai) {
        const tglDariFormatted = formatDateToSQL(String(filters?.tglDari));
        const tglSampaiFormatted = formatDateToSQL(String(filters?.tglSampai));
        query.whereBetween('b.created_at', [
          tglDariFormatted,
          tglSampaiFormatted,
        ]);
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
      console.error('Error fetching bank data:', error);
      throw new Error('Failed to fetch bank data');
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} shipper`;
  }

  update(id: number, updateShipperDto: UpdateShipperDto) {
    return `This action updates a #${id} shipper`;
  }

  remove(id: number) {
    return `This action removes a #${id} shipper`;
  }
}

// import {
//   Inject,
//   Injectable,
//   InternalServerErrorException,
//   NotFoundException,
// } from '@nestjs/common';
// import { CreateShipperDto } from './dto/create-shipper.dto';
// import { UpdateShipperDto } from './dto/update-shipper.dto';
// import { FindAllParams } from 'src/common/interfaces/all.interface';
// import { LogtrailService } from 'src/common/logtrail/logtrail.service';
// import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
// import { RedisService } from 'src/common/redis/redis.service';
// import { RelasiService } from 'src/relasi/relasi.service';

// @Injectable()
// export class ShipperService {
//   constructor(
//     @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
//     private readonly utilsService: UtilsService,
//     private readonly logTrailService: LogtrailService,
//     private readonly relasiService: RelasiService,
//   ) {}
//   private readonly tableName = 'shipper';

//   async create(createShipperDto: any, trx: any) {
//     try {
//       const {
//         sortBy,
//         sortDirection,
//         filters,
//         search,
//         page,
//         limit,
//         coa_text,
//         coapiutang_text,
//         coahutang_text,
//         coagiro_text,
//         marketing_text,
//         text,
//         ...insertData
//       } = createShipperDto;
//       insertData.updated_at = this.utilsService.getTime();
//       insertData.created_at = this.utilsService.getTime();

//       Object.keys(insertData).forEach((key) => {
//         if (typeof insertData[key] === 'string') {
//           insertData[key] = insertData[key].toUpperCase();
//         }
//       });

//       const insertedItems = await trx(this.tableName)
//         .insert(insertData)
//         .returning('*');

//       const statusRelasi = await trx('parameter')
//         .select('*')
//         .where('grp', 'STATUS RELASI')
//         .where('text', 'SHIPPER')
//         .first();

//       const relasi = {
//         nama: insertData.nama,
//         statusrelasi: statusRelasi.id,
//         coagiro: insertData.coagiro,
//         coapiutang: insertData.coapiutang,
//         coahutang: insertData.coahutang,
//         alamat: insertData.alamat,
//         npwp: insertData.npwp,
//         // namapajak: insertData.namapajak, // No namapajak in shipper
//         // alamatpajak: insertData.alamatpajak, // No alamatpajak in shipper
//         statusaktif: insertData.statusaktif,
//         modifiedby: insertData.modifiedby,
//       };
//       const dataRelasi = await this.relasiService.create(relasi, trx);

//       const newItem = insertedItems[0];
//       await trx(this.tableName)
//         .update({
//           relasi_id: Number(dataRelasi.id),
//           statusrelasi: statusRelasi.id,
//         })
//         .where('id', newItem.id)
//         .returning('*');

//       const { data, pagination } = await this.findAll(
//         {
//           search,
//           filters,
//           pagination: { page, limit },
//           sort: { sortBy, sortDirection },
//           isLookUp: false,
//         },
//         trx,
//       );
//       let itemIndex = data.findIndex((item) => item.id === newItem.id);
//       if (itemIndex === -1) {
//         itemIndex = 0;
//       }

//       const pageNumber = pagination?.currentPage;

//       await this.redisService.set(
//         `${this.tableName}-allItems`,
//         JSON.stringify(data),
//       );

//       await this.logTrailService.create(
//         {
//           namatabel: this.tableName,
//           postingdari: 'ADD SHIPPER',
//           idtrans: newItem.id,
//           nobuktitrans: newItem.id,
//           aksi: 'ADD',
//           datajson: JSON.stringify(newItem),
//           modifiedby: newItem.modifiedby,
//         },
//         trx,
//       );

//       return {
//         newItem,
//         pageNumber,
//         itemIndex,
//       };
//     } catch (error) {
//       throw new Error(`Error creating SHIPPER: ${error.message}`);
//     }
//   }

//   async findAll(
//     { search, filters, pagination, sort, isLookUp }: FindAllParams,
//     trx: any,
//   ) {
//     try {
//       // default pagination
//       let { page, limit } = pagination;

//       page = page ?? 1;
//       limit = limit ?? 0;

//       // lookup mode: jika total > 500, kirim json saja
//       if (isLookUp) {
//         const countResult = await trx(this.tableName)
//           .count('id as total')
//           .first();
//         const totalCount = Number(countResult?.total) || 0;
//         if (totalCount > 500) {
//           return { data: { type: 'json' } };
//         }
//         limit = 0;
//       }

//       // build query
//       const query = trx(`${this.tableName} as b`)
//         .select([
//           'b.id',
//           'b.statusrelasi',
//           'b.relasi_id',
//           'b.nama',
//           'b.keterangan',
//           'b.contactperson',
//           'b.alamat',
//           'b.coa',
//           'b.coapiutang',
//           'b.coahutang',
//           'b.kota',
//           'b.kodepos',
//           'b.telp',
//           'b.email',
//           'b.fax',
//           'b.web',
//           'b.creditlimit',
//           'b.creditterm',
//           'b.credittermplus',
//           'b.npwp',
//           'b.coagiro',
//           'b.ppn',
//           'b.titipke',
//           'b.ppnbatalmuat',
//           'b.grup',
//           'b.formatdeliveryreport',
//           'b.comodity',
//           'b.namashippercetak',
//           'b.formatcetak',
//           'b.marketing_id',
//           'b.blok',
//           'b.nomor',
//           'b.rt',
//           'b.rw',
//           'b.kelurahan',
//           'b.kabupaten',
//           'b.kecamatan',
//           'b.propinsi',
//           'b.isdpp10psn',
//           'b.usertracing',
//           'b.passwordtracing',
//           'b.kodeprospek',
//           'b.namashipperprospek',
//           'b.emaildelay',
//           'b.keterangan1barisinvoice',
//           'b.nik',
//           'b.namaparaf',
//           'b.saldopiutang',
//           'b.keteranganshipperjobminus',
//           'b.tglemailshipperjobminus',
//           'b.tgllahir',
//           'b.initial',
//           'b.tipe',
//           'b.idtipe',
//           'b.idinitial',
//           'b.nshipperprospek',
//           'b.parentshipper_id',
//           'b.npwpnik',
//           'b.nitku',
//           'b.kodepajak',
//           'b.statusaktif',
//           'b.info',
//           'b.modifiedby',
//           trx.raw("FORMAT(b.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
//           trx.raw("FORMAT(b.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
//           'p.memo',
//           'p.text',
//           'q.keterangancoa as coa_text',
//           'q2.keterangancoa as coapiutang_text',
//           'q3.keterangancoa as coahutang_text',
//           'q4.keterangancoa as coagiro_text',
//           'm.nama as marketing_text',
//         ])
//         .leftJoin('parameter as p', 'b.statusaktif', 'p.id')
//         .leftJoin('akunpusat as q', 'b.coa', 'q.id')
//         .leftJoin('akunpusat as q2', 'b.coapiutang', 'q2.id')
//         .leftJoin('akunpusat as q3', 'b.coahutang', 'q3.id')
//         .leftJoin('akunpusat as q4', 'b.coagiro', 'q4.id')
//         .leftJoin('marketing as m', 'b.marketing_id', 'm.id');

//       if (filters?.tglDari && filters?.tglSampai) {
//         // Mengonversi tglDari dan tglSampai ke format yang diterima SQL (YYYY-MM-DD)
//         const tglDariFormatted = formatDateToSQL(String(filters?.tglDari)); // Fungsi untuk format
//         const tglSampaiFormatted = formatDateToSQL(String(filters?.tglSampai));

//         // Menggunakan whereBetween dengan tanggal yang sudah diformat
//         query.whereBetween('b.created_at', [
//           tglDariFormatted,
//           tglSampaiFormatted,
//         ]);
//       }
//       if (search) {
//         const val = `%${String(search).replace(/\[/g, '[[]')}%`;

//         query.where((builder) => {
//           builder
//             .orWhere('b.nama', 'like', val)
//             .orWhere('b.keterangan', 'like', val)
//             .orWhere('q.keterangancoa', 'like', val)
//             .orWhere('q2.keterangancoa', 'like', val)
//             .orWhere('q3.keterangancoa', 'like', val)
//             .orWhere('q4.keterangancoa', 'like', val)
//             .orWhere('m.nama', 'like', val)
//             .orWhere('p.text', 'like', val);
//         });
//       }

//       if (filters) {
//         for (const [key, value] of Object.entries(filters)) {
//           const sanitizedValue = String(value).replace(/\[/g, '[[]');
//           if (value) {
//             if (key === 'created_at' || key === 'updated_at') {
//               query.andWhereRaw(
//                 "FORMAT(b.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?",
//                 [key, `%${sanitizedValue}%`],
//               );
//             } else if (key === 'coa_text') {
//               query.andWhere(`q.keterangancoa`, 'like', `%${sanitizedValue}%`);
//             } else if (key === 'coapiutang_text') {
//               query.andWhere(`q2.keterangancoa`, 'like', `%${sanitizedValue}%`);
//             } else if (key === 'coahutang_text') {
//               query.andWhere(`q3.keterangancoa`, 'like', `%${sanitizedValue}%`);
//             } else if (key === 'coagiro_text') {
//               query.andWhere(`q4.keterangancoa`, 'like', `%${sanitizedValue}%`);
//             } else if (key === 'marketing_text') {
//               query.andWhere(`m.nama`, 'like', `%${sanitizedValue}%`);
//             } else if (key === 'text') {
//               query.andWhere(`p.text`, 'like', `%${sanitizedValue}%`);
//             } else {
//               query.andWhere(`b.${key}`, 'like', `%${sanitizedValue}%`);
//             }
//           }
//         }
//       }

//       const totalQuery = trx(this.tableName)
//         .count('id as total')
//         .first();

//       if (search) {
//         const val = `%${String(search).replace(/\[/g, '[[]')}%`;
//         totalQuery.where((builder) => {
//           builder
//             .orWhere('nama', 'like', val)
//             .orWhere('keterangan', 'like', val);
//         });
//       }

//       if (filters) {
//         for (const [key, value] of Object.entries(filters)) {
//           const sanitizedValue = String(value).replace(/\[/g, '[[]');
//           if (value) {
//             if (key === 'created_at' || key === 'updated_at') {
//               totalQuery.andWhereRaw(
//                 "FORMAT(??, 'dd-MM-yyyy HH:mm:ss') LIKE ?",
//                 [key, `%${sanitizedValue}%`],
//               );
//             } else {
//               totalQuery.andWhere(`${key}`, 'like', `%${sanitizedValue}%`);
//             }
//           }
//         }
//       }

//       const result = await totalQuery;
//       const total = result?.total as number;
//       const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

//       if (sort?.sortBy && sort?.sortDirection) {
//         query.orderBy(sort.sortBy, sort.sortDirection);
//       }

//       if (limit > 0) {
//         const offset = (page - 1) * limit;
//         query.limit(limit).offset(offset);
//       }

//       const data = await query;
//       const responseType = Number(total) > 500 ? 'json' : 'local';

//       return {
//         data: data,
//         type: responseType,
//         total,
//         pagination: {
//           currentPage: page,
//           totalPages: totalPages,
//           totalItems: total,
//           itemsPerPage: limit,
//         },
//       };
//     } catch (error) {
//       console.error('Error fetching shipper data:', error);
//       throw new Error('Failed to fetch shipper data');
//     }
//   }

//   async findOne(id: number, trx: any) {
//     try {
//       const result = await trx(this.tableName).where('id', id).first();

//       if (!result) {
//         throw new Error('Data not found');
//       }

//       return result;
//     } catch (error) {
//       console.error('Error fetching data by id:', error);
//       throw new Error('Failed to fetch data by id');
//     }
//   }

//   async update(id: number, data: any, trx: any) {
//     try {
//       const existingData = await trx(this.tableName).where('id', id).first();

//       if (!existingData) {
//         throw new Error('Shipper not found');
//       }

//       const {
//         sortBy,
//         sortDirection,
//         filters,
//         search,
//         page,
//         limit,
//         coa_text,
//         coapiutang_text,
//         coahutang_text,
//         coagiro_text,
//         marketing_text,
//         text,
//         ...insertData
//       } = data;
//       Object.keys(insertData).forEach((key) => {
//         if (typeof insertData[key] === 'string') {
//           insertData[key] = insertData[key].toUpperCase();
//         }
//       });
//       const hasChanges = this.utilsService.hasChanges(insertData, existingData);
//       if (hasChanges) {
//         insertData.updated_at = this.utilsService.getTime();
//         await trx(this.tableName).where('id', id).update(insertData);
//       }

//       const { data: filteredData, pagination } = await this.findAll(
//         {
//           search,
//           filters,
//           pagination: { page, limit },
//           sort: { sortBy, sortDirection },
//           isLookUp: false, // Set based on your requirement (e.g., lookup flag)
//         },
//         trx,
//       );

//       // Cari index item yang baru saja diupdate
//       const itemIndex = filteredData.findIndex(
//         (item) => Number(item.id) === id,
//       );
//       if (itemIndex === -1) {
//         throw new Error('Updated item not found in all items');
//       }
//       const statusRelasi = await trx('parameter')
//         .select('*')
//         .where('grp', 'STATUS RELASI')
//         .where('text', 'SHIPPER')
//         .first();
//       const relasi = {
//         nama: insertData.nama,
//         statusrelasi: statusRelasi.id,
//         coagiro: insertData.coagiro,
//         coapiutang: insertData.coapiutang,
//         coahutang: insertData.coahutang,
//         alamat: insertData.alamat,
//         npwp: insertData.npwp,
//         // namapajak: insertData.namapajak, // No namapajak in shipper
//         // alamatpajak: insertData.alamatpajak, // No alamatpajak in shipper
//         statusaktif: insertData.statusaktif,
//         modifiedby: insertData.modifiedby,
//       };
//       const dataRelasi = await this.relasiService.update(
//         existingData.relasi_id,
//         relasi,
//         trx,
//       );
//       const itemsPerPage = limit || 10; // Default 10 items per page, atau yang dikirimkan dari frontend
//       const pageNumber = Math.floor(itemIndex / itemsPerPage) + 1;

//       // Ambil data hingga halaman yang mencakup item yang baru diperbarui
//       const endIndex = pageNumber * itemsPerPage;
//       const limitedItems = filteredData.slice(0, endIndex);
//       await this.redisService.set(
//         `${this.tableName}-allItems`,
//         JSON.stringify(limitedItems),
//       );

//       await this.logTrailService.create(
//         {
//           namatabel: this.tableName,
//           postingdari: 'EDIT SHIPPER',
//           idtrans: id,
//           nobuktitrans: id,
//           aksi: 'EDIT',
//           datajson: JSON.stringify(data),
//           modifiedby: data.modifiedby,
//         },
//         trx,
//       );

//       return {
//         updatedItem: {
//           id,
//           ...data,
//         },
//         pageNumber,
//         itemIndex,
//       };
//     } catch (error) {
//       console.error('Error updating shipper:', error);
//       throw new Error('Failed to update shipper');
//     }
//   }

//   async remove(id: number, trx: any, modifiedby: string) {
//     try {
//       const deletedData = await this.utilsService.lockAndDestroy(
//         id,
//         this.tableName,
//         'id',
//         trx,
//       );

//       await this.logTrailService.create(
//         {
//           namatabel: this.tableName,
//           postingdari: 'DELETE SHIPPER',
//           idtrans: deletedData.id,
//           nobuktitrans: deletedData.id,
//           aksi: 'DELETE',
//           datajson: JSON.stringify(deletedData),
//           modifiedby: modifiedby,
//         },
//         trx,
//       );

//       const dataRelasi = await this.relasiService.delete(
//         deletedData.relasi_id,
//         trx,
//         modifiedby,
//       );

//       return { status: 200, message: 'Data deleted successfully', deletedData };
//     } catch (error) {
//       console.error('Error deleting data:', error);
//       if (error instanceof NotFoundException) {
//         throw error;
//       }
//       throw new InternalServerErrorException('Failed to delete data');
//     }
//   }
// }
