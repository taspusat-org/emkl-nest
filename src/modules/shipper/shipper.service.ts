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
import { RelasiService } from '../relasi/relasi.service';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook, Column } from 'exceljs';
@Injectable()
export class ShipperService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly relasiService: RelasiService,
  ) {}
  private readonly tableName = 'shipper';
  async create(createShipperDto: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        coa_text,
        coapiutang_text,
        coahutang_text,
        coagiro_text,
        marketing_text,
        text,
        shipperasal_text,
        parentshipper_text,
        ...insertData
      } = createShipperDto;
      insertData.updated_at = this.utilsService.getTime();
      insertData.created_at = this.utilsService.getTime();

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });

      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      const statusRelasi = await trx('parameter')
        .select('*')
        .where('grp', 'STATUS RELASI')
        .where('text', 'SHIPPER')
        .first();

      const relasi = {
        nama: insertData.nama,
        statusrelasi: statusRelasi.id,
        coagiro: insertData.coagiro,
        coapiutang: insertData.coapiutang,
        coahutang: insertData.coahutang,
        alamat: insertData.alamat,
        npwp: insertData.npwp,
        statusaktif: insertData.statusaktif,
        modifiedby: insertData.modifiedby,
      };
      const dataRelasi = await this.relasiService.create(relasi, trx);

      const newItem = insertedItems[0];
      await trx(this.tableName)
        .update({
          relasi_id: Number(dataRelasi.id),
          statusrelasi: statusRelasi.id,
        })
        .where('id', newItem.id)
        .returning('*');

      const { data, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit: 0 },
          sort: { sortBy, sortDirection },
          isLookUp: false,
        },
        trx,
      );
      let itemIndex = data.findIndex((item) => item.id === newItem.id);
      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const pageNumber = pagination?.currentPage;

      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(data),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD SHIPPER',
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
      throw new Error(`Error creating SHIPPER: ${error.message}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      // default pagination
      let { page, limit } = pagination ?? {};

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

      const query = trx
        .from(trx.raw(`${this.tableName} as b WITH (READUNCOMMITTED)`))
        .select([
          'b.id',
          'b.statusrelasi',
          'b.relasi_id',
          'b.nama',
          'b.keterangan',
          'b.contactperson',
          'b.alamat',
          'b.coa',
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
          trx.raw(
            "FORMAT(b.tglemailshipperjobminus, 'dd-MM-yyyy') as tglemailshipperjobminus",
          ),
          trx.raw("FORMAT(b.tgllahir, 'dd-MM-yyyy') as tgllahir"),
          'b.idshipperasal',
          'b.initial',
          'b.tipe',
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
          's2.nama as parentshipper_text',
          'm.nama as marketing_text',
        ])
        .leftJoin(
          trx.raw('parameter as p WITH (READUNCOMMITTED)'),
          'b.statusaktif',
          'p.id',
        )
        .leftJoin(
          trx.raw('akunpusat as q WITH (READUNCOMMITTED)'),
          'b.coa',
          'q.coa',
        )
        .leftJoin(
          trx.raw('akunpusat as q2 WITH (READUNCOMMITTED)'),
          'b.coapiutang',
          'q2.coa',
        )
        .leftJoin(
          trx.raw('akunpusat as q3 WITH (READUNCOMMITTED)'),
          'b.coahutang',
          'q3.coa',
        )
        .leftJoin(
          trx.raw('akunpusat as q4 WITH (READUNCOMMITTED)'),
          'b.coagiro',
          'q4.coa',
        )
        .leftJoin(
          trx.raw('shipper as s WITH (READUNCOMMITTED)'),
          'b.idshipperasal',
          's.id',
        )
        .leftJoin(
          trx.raw('shipper as s2 WITH (READUNCOMMITTED)'),
          'b.parentshipper_id',
          's2.id',
        )
        .leftJoin(
          trx.raw('marketing as m WITH (READUNCOMMITTED)'),
          'b.marketing_id',
          'm.id',
        );

      // full-text search pada kolom teks
      if (search) {
        const val = String(search).replace(/\[/g, '[[]');
        query.where((builder) =>
          builder
            .orWhere('b.nama', 'like', `%${val}%`)
            .orWhere('b.keterangan', 'like', `%${val}%`)
            .orWhere('b.contactperson', 'like', `%${val}%`)
            .orWhere('b.alamat', 'like', `%${val}%`)
            .orWhere('b.kota', 'like', `%${val}%`)
            .orWhere('b.coa', 'like', `%${val}%`)
            .orWhere('b.telp', 'like', `%${val}%`)
            .orWhere('b.email', 'like', `%${val}%`)
            .orWhere('b.npwp', 'like', `%${val}%`)
            .orWhere('b.grup', 'like', `%${val}%`)
            .orWhere('b.namashippercetak', 'like', `%${val}%`)
            .orWhere('b.namashipperprospek', 'like', `%${val}%`)
            .orWhere('b.nik', 'like', `%${val}%`)
            .orWhere('b.namaparaf', 'like', `%${val}%`)
            .orWhere('b.initial', 'like', `%${val}%`)
            .orWhere('b.tipe', 'like', `%${val}%`)
            .orWhere('b.npwpnik', 'like', `%${val}%`)
            .orWhere('b.nitku', 'like', `%${val}%`)
            .orWhere('b.kodepajak', 'like', `%${val}%`)
            .orWhere('b.info', 'like', `%${val}%`)
            .orWhere('b.modifiedby', 'like', `%${val}%`)
            .orWhere('p.memo', 'like', `%${val}%`)
            .orWhere('p.text', 'like', `%${val}%`)
            .orWhere('q.keterangancoa', 'like', `%${val}%`)
            .orWhere('q2.keterangancoa', 'like', `%${val}%`)
            .orWhere('q3.keterangancoa', 'like', `%${val}%`)
            .orWhere('q4.keterangancoa', 'like', `%${val}%`)
            .orWhere('s.nama', 'like', `%${val}%`)
            .orWhere('s2.nama', 'like', `%${val}%`)
            .orWhere('m.nama', 'like', `%${val}%`),
        );
      }

      // filter per kolom
      if (filters) {
        for (const [key, rawValue] of Object.entries(filters)) {
          if (rawValue == null || rawValue === '') continue;
          const val = String(rawValue).replace(/\[/g, '[[]');

          // tanggal / timestamp
          if (key === 'coa_text') {
            query.andWhere('q.keterangancoa', 'like', `%${val}%`);
          } else if (key === 'coapiutang_text') {
            query.andWhere('q2.keterangancoa', 'like', `%${val}%`);
          } else if (key === 'coahutang_text') {
            query.andWhere('q3.keterangancoa', 'like', `%${val}%`);
          } else if (key === 'coagiro_text') {
            query.andWhere('q4.keterangancoa', 'like', `%${val}%`);
          } else if (key === 'shipperasal_text') {
            query.andWhere('s.nama', 'like', `%${val}%`);
          } else if (key === 'parentshipper_text') {
            query.andWhere('s2.nama', 'like', `%${val}%`);
          } else if (key === 'marketing_text') {
            query.andWhere('m.nama', 'like', `%${val}%`);
          } else if (
            [
              'created_at',
              'updated_at',
              'tgllahir',
              'tglemailshipperjobminus',
            ].includes(key)
          ) {
            query.andWhereRaw("FORMAT(b.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
              key,
              `%${val}%`,
            ]);
          }
          // kolom teks lainnya
          else if (
            [
              'nama',
              'keterangan',
              'contactperson',
              'alamat',
              'kota',
              'kodepos',
              'telp',
              'email',
              'fax',
              'web',
              'npwp',
              'grup',
              'comodity',
              'namashippercetak',
              'formatcetak',
              'blok',
              'nomor',
              'rt',
              'rw',
              'kelurahan',
              'kabupaten',
              'kecamatan',
              'propinsi',
              'usertracing',
              'passwordtracing',
              'kodeprospek',
              'namashipperprospek',
              'emaildelay',
              'keterangan1barisinvoice',
              'nik',
              'namaparaf',
              'keteranganshipperjobminus',
              'initial',
              'tipe',
              'npwpnik',
              'nitku',
              'kodepajak',
              'info',
              '',
              'modifiedby',
            ].includes(key)
          ) {
            query.andWhere(`b.${key}`, 'like', `%${val}%`);
          }
          // kolom numerik
          else if (
            [
              'id',
              'statusrelasi',
              'relasi_id',
              'coa',
              'coapiutang',
              'coahutang',
              'creditlimit',
              'creditterm',
              'credittermplus',
              'coagiro',
              'ppn',
              'titipke',
              'ppnbatalmuat',
              'formatdeliveryreport',
              'marketing_id',
              'isdpp10psn',
              'saldopiutang',
              'idshipperasal',
              'idtipe',
              'idinitial',
              'nshipperprospek',
              'parentshipper_id',
              'statusaktif',
            ].includes(key)
          ) {
            query.andWhere(`b.${key}`, Number(val));
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
      console.error('Error fetching shipper data:', error);
      throw new Error('Failed to fetch shipper data');
    }
  }

  async update(id: number, data: any, trx: any) {
    try {
      const existingData = await trx(this.tableName).where('id', id).first();

      if (!existingData) {
        throw new Error('Shipper not found');
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        coa_text,
        coapiutang_text,
        coahutang_text,
        coagiro_text,
        marketing_text,
        text,
        shipperasal_text,
        parentshipper_text,
        ...insertData
      } = data;
      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });
      const hasChanges = this.utilsService.hasChanges(insertData, existingData);
      if (hasChanges) {
        insertData.updated_at = this.utilsService.getTime();
        await trx(this.tableName).where('id', id).update(insertData);
      }

      const { data: filteredData, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit: 0 },
          sort: { sortBy, sortDirection },
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );

      // Cari index item yang baru saja diupdate
      const itemIndex = filteredData.findIndex(
        (item) => Number(item.id) === id,
      );
      if (itemIndex === -1) {
        throw new Error('Updated item not found in all items');
      }
      const statusRelasi = await trx('parameter')
        .select('*')
        .where('grp', 'STATUS RELASI')
        .where('text', 'SHIPPER')
        .first();
      const relasi = {
        nama: insertData.nama,
        statusrelasi: statusRelasi.id,
        coagiro: insertData.coagiro,
        coapiutang: insertData.coapiutang,
        coahutang: insertData.coahutang,
        alamat: insertData.alamat,
        npwp: insertData.npwp,
        statusaktif: insertData.statusaktif,
        modifiedby: insertData.modifiedby,
      };
      const dataRelasi = await this.relasiService.update(
        existingData.relasi_id,
        relasi,
        trx,
      );
      const itemsPerPage = limit || 10; // Default 10 items per page, atau yang dikirimkan dari frontend
      const pageNumber = Math.floor(itemIndex / itemsPerPage) + 1;

      // Ambil data hingga halaman yang mencakup item yang baru diperbarui
      const endIndex = pageNumber * itemsPerPage;
      const limitedItems = filteredData.slice(0, endIndex);
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'EDIT SHIPPER',
          idtrans: id,
          nobuktitrans: id,
          aksi: 'EDIT',
          datajson: JSON.stringify(data),
          modifiedby: data.modifiedby,
        },
        trx,
      );

      return {
        updatedItem: {
          id,
          ...data,
        },
        pageNumber,
        itemIndex,
      };
    } catch (error) {
      console.error('Error updating shipper:', error);
      throw new Error('Failed to update shipper');
    }
  }

  async delete(id: number, trx: any, modifiedby: string) {
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
          postingdari: 'DELETE SHIPPER',
          idtrans: deletedData.id,
          nobuktitrans: deletedData.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedData),
          modifiedby: modifiedby,
        },
        trx,
      );

      const dataRelasi = await this.relasiService.delete(
        deletedData.relasi_id,
        trx,
        modifiedby,
      );

      return { status: 200, message: 'Data deleted successfully', deletedData };
    } catch (error) {
      console.error('Error deleting data:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete data');
    }
  }

  async exportToExcel(data: any[]) {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Data Export');

    worksheet.mergeCells('A1:G1');
    worksheet.mergeCells('A2:G2');
    worksheet.mergeCells('A3:G3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN SHIPPER';
    worksheet.getCell('A3').value = 'Data Export';
    ['A1', 'A2', 'A3'].forEach((cellKey, i) => {
      worksheet.getCell(cellKey).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      worksheet.getCell(cellKey).font = {
        name: 'Tahoma',
        size: i === 0 ? 14 : 10,
        bold: true,
      };
    });

    const headers = [
      'NO.',
      'NAMA',
      'KETERANGAN',
      'KODE PROSPEK',
      'NPWP',
      'NIK',
      'TELEPON',
    ];

    headers.forEach((header, index) => {
      const cell = worksheet.getCell(5, index + 1);
      cell.value = header;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF00' },
      };
      cell.font = { bold: true, name: 'Tahoma', size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    data.forEach((row, rowIndex) => {
      const currentRow = rowIndex + 6;
      const rowValues = [
        rowIndex + 1,
        row.nama,
        row.keterangan,
        row.kodeprospek,
        row.npwp,
        row.nik,
        row.telp,
      ];
      rowValues.forEach((value, colIndex) => {
        const cell = worksheet.getCell(currentRow, colIndex + 1);
        cell.value = value ?? '';
        cell.font = { name: 'Tahoma', size: 10 };
        cell.alignment = {
          horizontal: colIndex === 0 ? 'right' : 'left',
          vertical: 'middle',
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    worksheet.columns
      .filter((c): c is Column => !!c)
      .forEach((col) => {
        let maxLength = 0;
        col.eachCell({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, cellValue.length);
        });
        col.width = maxLength + 2;
      });

    worksheet.getColumn(1).width = 6;
    worksheet.getColumn(6).width = 20;
    worksheet.getColumn(7).width = 20;
    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_container_${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath;
  }
}
