import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateMasterBiayaDto } from './dto/create-masterbiaya.dto';
import { UpdateMasterBiayaDto } from './dto/update-masterbiaya.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook, Column } from 'exceljs';

@Injectable()
export class MasterbiayaService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}
  private readonly tableName = 'masterbiaya';
  async create(CreateMasterBiayaDto: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        tujuankapal_id,
        sandarkapal_id,
        pelayaran_id,
        container_id,
        biayaemkl_id,
        jenisorder_id,
        tglberlaku,
        nominal,
        statusaktif,
        modifiedby,
        created_at,
        updated_at,
        info,
      } = CreateMasterBiayaDto;
      const insertData = {
        tujuankapal_id: tujuankapal_id,
        sandarkapal_id: sandarkapal_id,
        pelayaran_id: pelayaran_id,
        container_id: container_id,
        biayaemkl_id: biayaemkl_id,
        jenisorder_id: jenisorder_id,
        tglberlaku: formatDateToSQL(String(tglberlaku)),
        nominal: nominal,
        statusaktif: statusaktif,
        modifiedby: modifiedby,
        created_at: created_at || this.utilsService.getTime(),
        updated_at: updated_at || this.utilsService.getTime(),
      };
      // Insert the new item
      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');
      const newItem = insertedItems[0]; // Get the inserted item
      const { data, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit: 0 },
          sort: { sortBy, sortDirection },
          isLookUp: false, // Set based on your requirement (e.g., lookup flag)
        },
        trx,
      );
      let itemIndex = data.findIndex(
        (item) => Number(item.id) === Number(newItem.id),
      );
      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const pageNumber = Math.floor(itemIndex / limit) + 1;
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(data),
      );
      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD MASTER BIAYA',
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
      throw new Error(`Error creating MASTER BIAYA: ${error.message}`);
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

      // build query
      const query = trx
        .from(trx.raw(`${this.tableName} as b WITH (READUNCOMMITTED)`))
        .select([
          'b.id',
          'b.tujuankapal_id',
          'b.sandarkapal_id',
          'b.pelayaran_id',
          'b.container_id',
          'b.biayaemkl_id',
          'b.jenisorder_id',
          trx.raw("FORMAT(b.tglberlaku, 'dd-MM-yyyy') as tglberlaku"),
          'b.nominal',
          'b.statusaktif',
          'b.info',
          'b.modifiedby',
          trx.raw("FORMAT(b.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(b.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'p.memo',
          'p.text',
          'p2.nama as tujuankapal_text',
          'p3.nama as sandarkapal_text',
          'p4.nama as pelayaran_text',
          'p5.nama as container_text',
          'p6.nama as biayaemkl_text',
          'p7.nama as jenisorderan_text',
        ])
        .leftJoin(
          trx.raw('parameter as p WITH (READUNCOMMITTED)'),
          'b.statusaktif',
          'p.id',
        )
        .leftJoin(
          trx.raw('tujuankapal as p2 WITH (READUNCOMMITTED)'),
          'b.tujuankapal_id',
          'p2.id',
        )
        .leftJoin(
          trx.raw('sandarkapal as p3 WITH (READUNCOMMITTED)'),
          'b.sandarkapal_id',
          'p3.id',
        )
        .leftJoin(
          trx.raw('pelayaran as p4 WITH (READUNCOMMITTED)'),
          'b.pelayaran_id',
          'p4.id',
        )
        .leftJoin(
          trx.raw('container as p5 WITH (READUNCOMMITTED)'),
          'b.container_id',
          'p5.id',
        )
        .leftJoin(
          trx.raw('biayaemkl as p6 WITH (READUNCOMMITTED)'),
          'b.biayaemkl_id',
          'p6.id',
        )
        .leftJoin(
          trx.raw('jenisorderan as p7 WITH (READUNCOMMITTED)'),
          'b.jenisorder_id',
          'p7.id',
        );

      const excludeSearchKeys = [
        'tujuankapal_id',
        'sandarkapal_id',
        'pelayaran_id',
        'container_id',
        'biayaemkl_id',
        'jenisorder_id',
        'statusaktif',
      ];

      const searchFields = Object.keys(filters || {}).filter(
        (k) => !excludeSearchKeys.includes(k),
      );

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]').trim();

        query.where((qb) => {
          searchFields.forEach((field) => {
            if (['created_at', 'updated_at'].includes(field)) {
              qb.orWhereRaw("FORMAT(b.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
                field,
                `%${sanitizedValue}%`,
              ]);
            } else if (field === 'tglberlaku') {
              qb.orWhereRaw("FORMAT(b.tglberlaku, 'dd-MM-yyyy') like ?", [
                `%${sanitizedValue}%`,
              ]);
            } else if (field === 'memo' || field === 'text') {
              qb.orWhere(`p.${field}`, 'like', `%${sanitizedValue}%`);
            } else if (field === 'tujuankapal_text') {
              qb.orWhere('p2.nama', 'like', `%${sanitizedValue}%`);
            } else if (field === 'sandarkapal_text') {
              qb.orWhere('p3.nama', 'like', `%${sanitizedValue}%`);
            } else if (field === 'pelayaran_text') {
              qb.orWhere('p4.nama', 'like', `%${sanitizedValue}%`);
            } else if (field === 'container_text') {
              qb.orWhere('p5.nama', 'like', `%${sanitizedValue}%`);
            } else if (field === 'biayaemkl_text') {
              qb.orWhere('p6.nama', 'like', `%${sanitizedValue}%`);
            } else if (field === 'jenisorderan_text') {
              qb.orWhere('p7.nama', 'like', `%${sanitizedValue}%`);
            } else {
              qb.orWhere(`b.${field}`, 'like', `%${sanitizedValue}%`);
            }
          });
        });
      }

      if (filters) {
        for (const [key, rawValue] of Object.entries(filters)) {
          if (key === 'tglDari' || key === 'tglSampai') continue;
          if (!rawValue) continue;

          const val = String(rawValue).replace(/\[/g, '[[]');

          switch (key) {
            case 'created_at':
            case 'updated_at':
              query.andWhereRaw("FORMAT(b.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
                key,
                `%${val}%`,
              ]);
              break;

            case 'statusaktif':
              query.andWhere('b.statusaktif', 'like', `%${val}%`);
              break;

            case 'memo':
              query.andWhere('p.memo', 'like', `%${val}%`);
              break;

            case 'text':
              query.andWhere('p.text', 'like', `%${val}%`);
              break;

            case 'tujuankapal_text':
              query.andWhere('p2.nama', 'like', `%${val}%`);
              break;

            case 'sandarkapal_text':
              query.andWhere('p3.nama', 'like', `%${val}%`);
              break;

            case 'pelayaran_text':
              query.andWhere('p4.nama', 'like', `%${val}%`);
              break;

            case 'container_text':
              query.andWhere('p5.nama', 'like', `%${val}%`);
              break;

            case 'biayaemkl_text':
              query.andWhere('p6.nama', 'like', `%${val}%`);
              break;

            case 'jenisorderan_text':
              query.andWhere('p7.nama', 'like', `%${val}%`);
              break;

            default:
              query.andWhere(`b.${key}`, 'like', `%${val}%`);
              break;
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
      console.error('Error fetching biaya data:', error);
      throw new Error('Failed to fetch biaya data');
    }
  }

  async update(id: number, data: any, trx: any) {
    data.tglberlaku = formatDateToSQL(String(data?.tglberlaku));
    try {
      const existingData = await trx(this.tableName).where('id', id).first();

      if (!existingData) {
        throw new Error('Biaya not found');
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        tujuankapal_text,
        sandarkapal_text,
        pelayaran_text,
        container_text,
        biayaemkl_text,
        jenisorderan_text,
        text,
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
      let itemIndex = filteredData.findIndex(
        (item) => Number(item.id) === Number(id),
      );
      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const itemsPerPage = limit || 10; // Default 10 items per page, atau yang dikirimkan dari frontend
      const pageNumber = Math.floor(itemIndex / itemsPerPage) + 1;

      const endIndex = pageNumber * itemsPerPage;
      const limitedItems = filteredData.slice(0, endIndex);
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'EDIT MASTER BIAYA',
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
      console.error('Error updating Biaya:', error);
      throw new Error('Failed to update Biaya');
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
          postingdari: 'DELETE MASTER BIAYA',
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

    // Merge dan header utama
    worksheet.mergeCells('A1:J1');
    worksheet.mergeCells('A2:J2');
    worksheet.mergeCells('A3:J3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN MASTER BIAYA';
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

    // Header tabel
    const headers = [
      'NO.',
      'TUJUAN KAPAL',
      'SANDAR KAPAL',
      'PELAYARAN',
      'CONTAINER',
      'BIAYA EMKL',
      'JENIS ORDERAN',
      'TANGGAL BERLAKU',
      'NOMINAL',
      'STATUS AKTIF',
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
      cell.alignment = {
        horizontal: index === 0 || index === 8 ? 'center' : 'center', // NO. & NOMINAL -> kanan
        vertical: 'middle',
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    worksheet.getRow(5).height = 18;

    // Isi data
    data.forEach((row, rowIndex) => {
      const currentRow = rowIndex + 6;

      worksheet.getCell(currentRow, 1).value = rowIndex + 1;
      worksheet.getCell(currentRow, 2).value = row.tujuankapal_text;
      worksheet.getCell(currentRow, 3).value = row.sandarkapal_text;
      worksheet.getCell(currentRow, 4).value = row.pelayaran_text;
      worksheet.getCell(currentRow, 5).value = row.container_text;
      worksheet.getCell(currentRow, 6).value = row.biayaemkl_text;
      worksheet.getCell(currentRow, 7).value = row.jenisorderan_text;
      worksheet.getCell(currentRow, 8).value = row.tglberlaku;
      worksheet.getCell(currentRow, 9).value = row.nominal;
      worksheet.getCell(currentRow, 10).value = row.text;

      // Styling cell per baris
      for (let col = 1; col <= headers.length; col++) {
        const cell = worksheet.getCell(currentRow, col);
        cell.font = { name: 'Tahoma', size: 10 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        // Kolom 1 dan 9 align kanan, lainnya kiri
        if (col === 1 || col === 9) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      }
    });

    // Lebar kolom
    worksheet.getColumn(1).width = 6;
    worksheet.getColumn(2).width = 20;
    worksheet.getColumn(3).width = 30;
    worksheet.getColumn(4).width = 25;
    worksheet.getColumn(5).width = 25;
    worksheet.getColumn(6).width = 25;
    worksheet.getColumn(7).width = 25;
    worksheet.getColumn(8).width = 25;
    worksheet.getColumn(9).width = 25;
    worksheet.getColumn(10).width = 25;

    // Simpan file
    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_master_biaya_${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath;
  }
}
