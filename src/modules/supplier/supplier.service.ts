
import * as fs from 'fs';
import * as path from 'path';
import { Column, Workbook } from 'exceljs';
import { LocksService } from '../locks/locks.service';
import { GlobalService } from '../global/global.service';
import { RelasiService } from '../relasi/relasi.service';
import { RedisService } from 'src/common/redis/redis.service';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { HttpException, HttpStatus, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';

@Injectable()
export class SupplierService {
  private readonly tableName = 'supplier';

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilService: UtilsService,
    private readonly locksService: LocksService,
    private readonly globalService: GlobalService,
    private readonly relasiService: RelasiService,
    private readonly logTrailService: LogtrailService,
  ) {}

  async create(createData: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        method,
        statusaktif_nama,
        coa_nama,
        coapiu_nama,
        coahut_nama,
        coagiro_nama,
        id,
        ...insertData
      } = createData;
      insertData.updated_at = this.utilService.getTime();
      insertData.created_at = this.utilService.getTime();      

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          const value = insertData[key];
          const dateRegex = /^\d{2}-\d{2}-\d{4}$/;

          if (dateRegex.test(value)) {
            insertData[key] = formatDateToSQL(value);
          } else {
            insertData[key] = insertData[key].toUpperCase();
          }
        }
      });

      const insertedData = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      const statusRelasi = await trx('parameter')
        .select('*')
        .where('grp', 'STATUS RELASI')
        .where('text', this.tableName)
        .first();

      const relasi = {
        statusrelasi: statusRelasi.id,
        nama: insertData.nama,
        coagiro: insertData.coagiro,
        coapiutang: insertData.coapiu,
        coahutang: insertData.coahut,
        alamat: insertData.alamat,
        npwp: insertData.npwp,
        namapajak: insertData.namapajak,
        alamatpajak: insertData.alamatfakturpajak,
        statusaktif: insertData.statusaktif,
        modifiedby: insertData.modifiedby,
      };
      const insertRelasi = await this.relasiService.create(relasi, trx);

      const newItem = insertedData[0];
      await trx(this.tableName)
        .update({
          relasi_id: Number(insertRelasi.id),
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
      let dataIndex = data.findIndex((item) => item.id === newItem.id);
      if (dataIndex === -1) {
        dataIndex = 0;
      }

      const pageNumber = pagination?.currentPage;
      
      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(data),
      );

      await this.logTrailService.create(
        {
          namatable: this.tableName,
          postingdari: 'ADD SUPPLIER',
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
        dataIndex 
      };
    } catch (error) {
      throw new Error(`Error creating supplier: ${error.message}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      let { page, limit } = pagination ?? {};
      page = page ?? 1;
      limit = 0;

      if (isLookUp) {
        const totalData = await trx(this.tableName)
          .count('id as total')
          .first();

        const resultTotalData = totalData?.total || 0;

        if (Number(resultTotalData) > 500) {
          return {
            data: {
              type: 'json',
            },
          };
        } else {
          limit = 0;
        }
      }

      const query = trx.from(trx.raw(`${this.tableName} as u WITH (READUNCOMMITTED)`))
        .select([
          'u.id as id',
          'u.nama',
          'u.keterangan',
          'u.contactperson',
          'u.ktp',
          'u.alamat',
          'u.coa',
          'u.coapiu',
          'u.coahut',
          'u.coagiro',
          'u.kota',
          'u.kodepos',
          'u.telp',
          'u.email',
          'u.fax',
          'u.web',
          'u.creditterm',
          'u.credittermplus',
          'u.npwp',
          'u.alamatfakturpajak',
          'u.namapajak',
          'u.nominalpph21',
          'u.nominalpph23',
          'u.noskb',
          trx.raw("FORMAT(u.tglskb, 'dd-MM-yyyy') as tglskb"),
          'u.nosk',
          trx.raw("FORMAT(u.tglsk, 'dd-MM-yyyy') as tglsk"),
          'u.statusaktif',
          'u.modifiedby',
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'p.memo',
          'p.text as statusaktif_nama',
          'coa.keterangancoa as coa_nama',
          'coapiu.keterangancoa as coapiu_nama',
          'coahut.keterangancoa as coahut_nama',
          'coagiro.keterangancoa as coagiro_nama',
        ])
        .leftJoin('parameter as p', 'u.statusaktif', 'p.id')
        .leftJoin('akunpusat as coa', 'u.coa', 'coa.coa')
        .leftJoin('akunpusat as coapiu', 'u.coapiu', 'coapiu.coa')
        .leftJoin('akunpusat as coahut', 'u.coahut', 'coahut.coa')
        .leftJoin('akunpusat as coagiro', 'u.coagiro', 'coagiro.coa');
      
      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]');
        query.where((builder) => {
          builder
            .orWhere('u.nama', 'like', `%${sanitizedValue}%`)
            .orWhere('u.keterangan', 'like', `%${sanitizedValue}%`)
            .orWhere('u.contactperson', 'like', `%${sanitizedValue}%`)
            .orWhere('u.ktp', 'like', `%${sanitizedValue}%`)
            .orWhere('u.alamat', 'like', `%${sanitizedValue}%`)
            .orWhere('coa.keterangancoa', 'like', `%${sanitizedValue}%`)
            .orWhere('coapiu.keterangancoa', 'like', `%${sanitizedValue}%`)
            .orWhere('coahut.keterangancoa', 'like', `%${sanitizedValue}%`)
            .orWhere('coagiro.keterangancoa', 'like', `%${sanitizedValue}%`)
            .orWhere('u.kota', 'like', `%${sanitizedValue}%`)
            .orWhere('u.kodepos', 'like', `%${sanitizedValue}%`)
            .orWhere('u.telp', 'like', `%${sanitizedValue}%`)
            .orWhere('u.email', 'like', `%${sanitizedValue}%`)
            .orWhere('u.fax', 'like', `%${sanitizedValue}%`)
            .orWhere('u.web', 'like', `%${sanitizedValue}%`)
            .orWhere('u.creditterm', 'like', `%${sanitizedValue}%`)
            .orWhere('u.credittermplus', 'like', `%${sanitizedValue}%`)
            .orWhere('u.npwp', 'like', `%${sanitizedValue}%`)
            .orWhere('u.alamatfakturpajak', 'like', `%${sanitizedValue}%`)
            .orWhere('u.namapajak', 'like', `%${sanitizedValue}%`)
            .orWhere('u.nominalpph21', 'like', `%${sanitizedValue}%`)
            .orWhere('u.nominalpph23', 'like', `%${sanitizedValue}%`)
            .orWhere('u.noskb', 'like', `%${sanitizedValue}%`)
            .orWhere('u.tglskb', 'like', `%${sanitizedValue}%`)
            .orWhere('u.nosk', 'like', `%${sanitizedValue}%`)
            .orWhere('u.tglsk', 'like', `%${sanitizedValue}%`)
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
            } else if (key === 'statusaktif_text') {
              query.andWhere(`p.id`, '=', sanitizedValue);
            } else if (key === 'coa_text') {
              query.andWhere(`coa.keterangancoa`, '=', sanitizedValue);
            } else if (key === 'coapiu_text') {
              query.andWhere('coapiu.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (key === 'coahut_text') {
              query.andWhere(`coahut.keterangancoa`, '=', sanitizedValue);
            } else if (key === 'coagiro_text') {
              query.andWhere(`coagiro.keterangancoa`, '=', sanitizedValue);
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
        if (sort?.sortBy == 'coa') {
          query.orderBy('coa.keterangancoa', sort.sortDirection);
        } else if (sort?.sortBy == 'coapiu') {
          query.orderBy('coapiu.keterangancoa', sort.sortDirection);
        } else if (sort?.sortBy == 'coahut') {
          query.orderBy('coahut.keterangancoa', sort.sortDirection);
        } else if (sort?.sortBy == 'coagiro') {
          query.orderBy('coagiro.keterangancoa', sort.sortDirection);
        } else {
          query.orderBy(sort.sortBy, sort.sortDirection);
        }
      }

      const data = await query;
      const responseType = Number(total) > 500 ? 'json' : 'local';
      console.log('search', search, 'data', data);

      return {
        data: data,
        type: responseType,
        total,
        pagination: {
          currentPage: Number(page),
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: limit > 0 ? limit : total,
        },
      };
    } catch (error) {
      console.error('Error to findAll Supplier', error);
      throw new Error(error);
    }
  }

  async update(dataId: number, data: any, trx: any) {
    try {
      const existingData = await trx(this.tableName).where('id', dataId).first();

      if (!existingData) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Data Not Found!',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        method,
        statusaktif_nama,
        coa_nama,
        coapiu_nama,
        coahut_nama,
        coagiro_nama,
        id,
        ...updateData
      } = data;

      Object.keys(updateData).forEach((key) => {
        if (typeof updateData[key] === 'string') {
          const value = updateData[key];
          const dateRegex = /^\d{2}-\d{2}-\d{4}$/;

          if (dateRegex.test(value)) {
            updateData[key] = formatDateToSQL(value);
          } else {
            updateData[key] = updateData[key].toUpperCase();
          }
        }
      });

      const hasChanges = this.utilService.hasChanges(updateData, existingData);
      if (hasChanges) {
        updateData.updated_at = this.utilService.getTime();
        await trx(this.tableName).where('id', dataId).update(updateData);
      }

      const statusRelasi = await trx('parameter')
        .select('*')
        .where('grp', 'STATUS RELASI')
        .where('text', this.tableName)
        .first();
        
      const relasi = {
        statusrelasi: statusRelasi.id,
        nama: updateData.nama,
        coagiro: updateData.coagiro,
        coapiutang: updateData.coapiu,
        coahutang: updateData.coahut,
        alamat: updateData.alamat,
        npwp: updateData.npwp,
        namapajak: updateData.namapajak,
        alamatpajak: updateData.alamatfakturpajak,
        statusaktif: updateData.statusaktif,
        modifiedby: updateData.modifiedby,
      };

      const updateRelasi = await this.relasiService.update(
        existingData.relasi_id,
        relasi,
        trx,
      );
      const { data: filteredData, pagination } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit: 0 },
          sort: { sortBy, sortDirection },
          isLookUp: false,
        },
        trx,
      );

      let dataIndex = filteredData.findIndex(
        (item) => Number(item.id) === Number(dataId),
      );
      if (dataIndex === -1) {
        dataIndex = 0;
      }

      // if (dataIndex === -1) {
      //   throw new Error('Updated item not found in all items');
      // }

      const itemsPerPage = limit || 30;
      const pageNumber = Math.floor(dataIndex / itemsPerPage) + 1;
      const endIndex = pageNumber * itemsPerPage;
      const limitedItems = filteredData.slice(0, endIndex);

      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'EDIT SUPPLIER',
          idtrans: dataId,
          nobuktitrans: dataId,
          aksi: 'EDIT',
          datajson: JSON.stringify(data),
          modifiedby: data.modifiedby,
        },
        trx,
      );

      return {
        newItems: {
          dataId,
          ...data,
        },
        pageNumber,
        dataIndex,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      console.error('Error updating supplier:', error);
      throw new Error('Failed to update supplier');
    }
  }

  async delete(id: number, trx: any, modifiedby: string) {
    try {
      const deletedData = await this.utilService.lockAndDestroy(
        id,
        this.tableName,
        'id',
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE SUPPLIER',
          idtrans: id,
          nobuktitrans: id,
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

      return {
        status: 200,
        message: 'Data deleted successfully',
        deletedData,
      };
    } catch (error) {
      console.error('Error deleting data: ', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete data');
    }
  }

  async checkValidasi(aksi: string, value: any, editedby: any, trx: any) {
    try {
      if (aksi === 'EDIT') {
        const forceEdit = await this.locksService.forceEdit(
          this.tableName,
          value,
          editedby,
          trx,
        );

        return forceEdit;
      } else if (aksi === 'DELETE') {
        // const validasi = await this.globalService.checkUsed(
        //   'akunpusat',
        //   'type_id',
        //   value,
        //   trx,
        // );

        // return validasi;
        return {
          // tableName: tableName,
          // fieldName: fieldName,
          // fieldValue: fieldValue,
          status: 'success',
          message: 'Data aman untuk dihapus.',
        };
      }
    } catch (error) {
      console.error('Error di checkValidasi:', error);
      throw new InternalServerErrorException('Failed to check validation');
    }
  }

  async exportToExcel(data: any[]) {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Data Export');

    worksheet.mergeCells('A1:J1');
    worksheet.mergeCells('A2:J2');
    worksheet.mergeCells('A3:J3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN SUPPLIER';
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

    // Mendefinisikan header kolom
    const headers = [
      'NO.',
      'NAMA',
      'KETERANGAN',
      'CONTACT PERSON',
      'KTP',
      'ALAMAT',
      'COA',
      'COA PIUTANG',
      'COA HUTANG',
      'COA GIRO',
      'KOTA',
      'KODE POS',
      'TELP',
      'EMAIL',
      'FAX',
      'WEB',
      'CREDIT TERM',
      'CREDIT TERM PLUS',
      'NPWP',
      'ALAMAT FAKTUR PAJAK',
      'NAMA PAJAK',
      'NOMINAL PPH 21',
      'NOMINAL PPH 23',
      'NO SKB',
      'TGL SKB',
      'NO SK',
      'TGL SK',
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
        horizontal: 'center',
        vertical: 'middle',
      };

      // if (index === 2) {
      //   cell.alignment = { horizontal: 'right', vertical: 'middle' };
      //   cell.numFmt = '0'; // angka polos tanpa ribuan / desimal
      // } else {
      //   cell.alignment = {
      //     horizontal: index === 0 ? 'right' : 'left',
      //     vertical: 'middle',
      //   };
      // }

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
        row.contactperson,
        row.ktp,
        row.alamat,
        row.coa_nama,
        row.coapiu_nama,
        row.coahut_nama,
        row.coagiro_nama,
        row.kota,
        row.kodepos,
        row.telp,
        row.email,
        row.fax,
        row.web,
        row.creditterm,
        row.credittermplus,
        row.npwp,
        row.alamatfakturpajak,
        row.namapajak,
        row.nominalpph21,
        row.nominalpph23,
        row.noskb,
        row.tglskb,
        row.nosk,
        row.tglsk,
        row.statusaktif_nama,
      ];

      rowValues.forEach((value, colIndex) => {
        const cell = worksheet.getCell(currentRow, colIndex + 1);

        if (colIndex === 4 || colIndex === 11 || colIndex === 12 || colIndex === 16 || colIndex === 17) {
          cell.value = Number(value);
          cell.numFmt = '0'; // format angka dengan ribuan
          cell.alignment = {
            horizontal: 'right',
            vertical: 'middle',
          };
        } else if (colIndex === 21 || colIndex === 22) {
          cell.value = Number(value);
          cell.numFmt = '"Rp"#,##0'; // format angka dengan ribuan
          cell.alignment = {
            horizontal: 'right',
            vertical: 'middle',
          };
        }else {
          cell.value = value ?? '';
          cell.alignment = {
            horizontal: colIndex === 0 ? 'right' : 'left',
            vertical: 'middle',
          };
        }

        // cell.value = value ?? '';
        cell.font = { name: 'Tahoma', size: 10 };
        // cell.alignment = {
        //   horizontal: colIndex === 0 ? 'right' : 'left',
        //   vertical: 'middle',
        // };
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

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_supplier_${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath;
  }

  findOne(id: number) {
    return `This action returns a #${id} supplier`;
  }




}
