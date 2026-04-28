import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateAlatbayarDto } from './dto/create-alatbayar.dto';
import { UpdateAlatbayarDto } from './dto/update-alatbayar.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RedisService } from 'src/common/redis/redis.service';
import {
  calculateItemIndex,
  getFetchedPages,
  UtilsService,
} from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook, Column } from 'exceljs';

@Injectable()
export class AlatbayarService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
  ) {}
  private readonly tableName = 'alatbayar';
  async create(CreateAlatbayarDto: any, trx: any) {
    try {
      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        nama,
        keterangan,
        statuslangsungcair,
        statusdefault,
        statusbank,
        statusaktif,
        modifiedby,
        created_at,
        updated_at,
        info,
      } = CreateAlatbayarDto;
      const insertData = {
        nama: nama ? nama.toUpperCase() : null,
        keterangan: keterangan ? keterangan.toUpperCase() : null,
        statuslangsungcair: statuslangsungcair,
        statusdefault: statusdefault,
        statusbank: statusbank,
        statusaktif: statusaktif,
        modifiedby: modifiedby,
        created_at: created_at || this.utilsService.getTime(),
        updated_at: updated_at || this.utilsService.getTime(),
      };
      // Insert the new item
      const insertedItems = await trx(this.tableName).insert(insertData);
      const newItem = await trx(this.tableName).orderBy('id', 'desc').first();

      let posisi = 0;
      let totalItems = 0;
      const LastId = await trx(this.tableName)
        .select('id')
        .orderBy('id', 'desc')
        .first();
      const resultposition = await trx('valatbayar')
        .count('* as posisi')
        .where(
          sortBy,
          sortDirection === 'desc' ? '>=' : '<=',
          insertData[sortBy],
        )
        .where('id', '<=', LastId?.id)
        .modify((qb) => {
          if (search) {
            qb.where((builder) => {
              Object.keys(filters).forEach((key) => {
                builder.orWhere(key, 'like', `%${search}%`);
              });
            });
          }

          if (filters && Object.keys(filters).length > 0) {
            Object.entries(filters).forEach(([key, value]) => {
              if (value !== undefined && value !== null && value !== '') {
                qb.where(key, 'like', `%${value}%`);
              }
            });
          }
        })
        .first();
      const totalRecords = await trx(this.tableName)
        .count('id as total')
        .first();
      totalItems = totalRecords?.total || 0;

      posisi = resultposition?.posisi || 0;
      const pageNumber = Math.ceil(posisi / limit);
      const totalPages = Math.ceil(totalItems / limit);

      const fetchedPages = getFetchedPages(pageNumber, totalPages);

      // ========== SOLUSI BARU: SINGLE QUERY dengan custom offset ==========

      // Hitung range page
      const startPage = fetchedPages[0];
      const endPage = fetchedPages[fetchedPages.length - 1];

      // Hitung offset dan total data yang dibutuhkan
      const customOffset = (startPage - 1) * limit;
      const totalDataNeeded = (endPage - startPage + 1) * limit;

      // FETCH SEKALI SAJA dengan custom offset
      const result = await this.findAll(
        {
          search: search || '',
          filters: filters || {},
          pagination: {
            page: startPage, // page tidak dipakai karena useCustomOffset = true
            limit: totalDataNeeded, // ambil total data yang dibutuhkan
            customOffset: customOffset, // offset manual
          },
          sort: {
            sortBy: sortBy,
            sortDirection: sortDirection.toLowerCase(),
          },
          isLookUp: false,
          useCustomOffset: true, // flag untuk pakai custom offset
        },
        trx,
      );
      console.log('result', result);
      const allFetchedData = result?.data;
      // Split data ke pages di memory (sangat cepat!)
      const pagedData = {};
      let dataIndex = 0;

      fetchedPages.forEach((pageNum) => {
        const pageStartIndex = dataIndex;
        const pageEndIndex = dataIndex + limit;
        pagedData[pageNum] = allFetchedData.slice(pageStartIndex, pageEndIndex);
        dataIndex += limit;
      });

      // Hitung item index
      const itemIndex = calculateItemIndex(Number(posisi), fetchedPages, limit);

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'ADD ALAT-BAYAR',
          idtrans: newItem.id,
          nobuktitrans: newItem.id,
          aksi: 'ADD',
          datajson: JSON.stringify(newItem),
          modifiedby: newItem.modifiedby,
        },
        trx,
      );
      await this.redisService.set(
        `${this.tableName}-page-${pageNumber}`,
        JSON.stringify(allFetchedData),
      );
      return {
        newItem,
        itemIndex: itemIndex.zeroBasedIndex,
        pageNumber,
        fetchedPages,
        pagedData,
      };
    } catch (error) {
      throw new Error(`Error creating alat bayar: ${error.message}`);
    }
  }

  async findAll(
    {
      search,
      filters,
      pagination,
      sort,
      isLookUp,
      useCustomOffset,
    }: FindAllParams,
    trx: any,
  ) {
    try {
      const { page = 1, limit = 0, customOffset } = pagination ?? {};

      const excludeSearchKeys = [
        'statusaktif',
        'text',
        'icon',
        'statuslangsungcair',
        'statusdefault',
        'statusbank',
      ];
      const searchFields = Object.keys(filters || {}).filter(
        (k) => !excludeSearchKeys.includes(k),
      );
      const applyFilters = (query: any) => {
        // Apply search filter
        if (search) {
          const sanitizedValue = String(search).replace(/\[/g, '[[]');

          query.where((qb) => {
            searchFields.forEach((field) => {
              if (['created_at', 'updated_at'].includes(field)) {
                qb.orWhereRaw("FORMAT(ab.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
                  field,
                  `%${sanitizedValue}%`,
                ]);
              } else {
                qb.orWhere(`ab.${field}`, 'like', `%${sanitizedValue}%`);
              }
            });
          });
        }

        // Apply filters
        if (filters && Object.keys(filters).length > 0) {
          Object.entries(filters).forEach(([key, rawValue]) => {
            if (
              rawValue === null ||
              rawValue === undefined ||
              rawValue === ''
            ) {
              return;
            }

            const sanitizedValue = String(rawValue).replace(/[[\]%_]/g, '[$&]');

            // Cek apakah kolom timestamp
            if (['created_at', 'updated_at'].includes(key)) {
              query.andWhereRaw("FORMAT(ab.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
                key,
                `%${sanitizedValue}%`,
              ]);
            }
            // Cek apakah kolom numerik
            else {
              const numValue = Number(rawValue);
              if (!isNaN(numValue) && /^\d+$/.test(String(rawValue).trim())) {
                query.andWhere(`ab.${key}`, numValue);
              } else {
                query.andWhere(`ab.${key}`, 'like', `%${sanitizedValue}%`);
              }
            }
          });
        }

        return query;
      };

      const sortBy = sort?.sortBy || 'creditlimit';
      const sortDirection =
        sort?.sortDirection?.toLowerCase() === 'asc' ? 'asc' : 'desc';

      const countQuery = trx('alatbayar as ab');
      applyFilters(countQuery);
      const countResult = await countQuery.count('ab.id as total').first();
      const total = Number(countResult?.total || 0);

      const query = trx('valatbayar as ab').select([
        trx.raw(`ROW_NUMBER() OVER (ORDER BY ?? ${sortDirection}) as nomor`, [
          sortBy,
        ]),
        'ab.id',
        'ab.nama',
        'ab.keterangan',
        'ab.statuslangsungcair',
        'ab.statusdefault',
        'ab.statusbank',
        'ab.statusaktif',
        'ab.statuslangsungcair_text',
        'ab.statuslangsungcair_memo',
        'ab.statusdefault_text',
        'ab.statusdefault_memo',
        'ab.statusbank_text',
        'ab.statusbank_memo',
        'ab.text',
        'ab.memo',
        'ab.info',
        'ab.modifiedby',
        trx.raw("FORMAT(ab.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
        trx.raw("FORMAT(ab.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
      ]);

      applyFilters(query);
      query.orderBy(`ab.${sortBy}`, sortDirection);
      if (sortBy !== 'id') {
        query.orderBy('ab.id', 'asc');
      }

      const offset =
        useCustomOffset === true && customOffset !== undefined
          ? customOffset
          : (page - 1) * limit;

      if (limit > 0) {
        query.offset(offset).limit(limit);
      }
      const data = await query;

      const totalPages = Math.ceil(total / limit);
      const responseType = total > 500 ? 'json' : 'local';

      return {
        data,
        type: responseType,
        total,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      console.error('Error fetching alatbayar data:', error);
      throw new Error('Failed to fetch alatbayar data');
    }
  }

  async update(id: number, data: any, trx: any) {
    try {
      const existingData = await trx(this.tableName).where('id', id).first();

      if (!existingData) {
        throw new Error('Alat Bayar not found');
      }

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        statuslangsungcair_text,
        statusdefault_text,
        statusbank_text,
        text,
        id: SkipId,
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

      // ========== LOGIKA BARU: SAMA SEPERTI CREATE ==========

      // Hitung posisi item yang diupdate
      let posisi = 0;
      let totalItems = 0;

      const LastId = await trx(this.tableName)
        .select('id')
        .orderBy('id', 'desc')
        .first();
      const resultposition = await trx('valatbayar')
        .count('* as posisi')
        .where(
          sortBy,
          sortDirection === 'desc' ? '>=' : '<=',
          insertData[sortBy],
        )
        .where('id', '<=', LastId?.id)
        .modify((qb) => {
          if (search) {
            qb.where((builder) => {
              Object.keys(filters).forEach((key) => {
                builder.orWhere(key, 'like', `%${search}%`);
              });
            });
          }

          if (filters && Object.keys(filters).length > 0) {
            Object.entries(filters).forEach(([key, value]) => {
              if (value !== undefined && value !== null && value !== '') {
                qb.where(key, 'like', `%${value}%`);
              }
            });
          }
        })
        .first();

      const totalRecords = await trx(this.tableName)
        .count('id as total')
        .first();
      console.log('existingData[sortBy]', insertData[sortBy]);
      console.log('resultposition', resultposition);
      console.log('totalRecords', totalRecords);
      console.log('data', insertData);

      totalItems = totalRecords?.total || 0;
      posisi = resultposition?.posisi || 0;

      const pageNumber = Math.ceil(posisi / limit);
      const totalPages = Math.ceil(totalItems / limit);
      console.log('pageNumber', pageNumber);
      console.log('Debug pageNumber calculation:', {
        posisi,
        limit,
        division: posisi / limit,
        result: Math.ceil(posisi / limit),
      });
      const fetchedPages = getFetchedPages(pageNumber, totalPages);

      // ========== SINGLE QUERY dengan custom offset ==========
      const startPage = fetchedPages[0];
      const endPage = fetchedPages[fetchedPages.length - 1];

      const customOffset = (startPage - 1) * limit;
      const totalDataNeeded = (endPage - startPage + 1) * limit;

      // FETCH SEKALI SAJA dengan custom offset
      const result = await this.findAll(
        {
          search: search || '',
          filters: filters || {},
          pagination: {
            page: startPage,
            limit: totalDataNeeded,
            customOffset: customOffset,
          },
          sort: {
            sortBy: sortBy,
            sortDirection: sortDirection.toLowerCase(),
          },
          isLookUp: false,
          useCustomOffset: true,
        },
        trx,
      );

      const allFetchedData = result.data;

      // Split data ke pages di memory
      const pagedData = {};
      let dataIndex = 0;

      fetchedPages.forEach((pageNum) => {
        const pageStartIndex = dataIndex;
        const pageEndIndex = dataIndex + limit;
        pagedData[pageNum] = allFetchedData.slice(pageStartIndex, pageEndIndex);
        dataIndex += limit;
      });

      // Hitung item index
      const itemIndex = calculateItemIndex(Number(posisi), fetchedPages, limit);

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'EDIT ALAT BAYAR',
          idtrans: id,
          nobuktitrans: id,
          aksi: 'EDIT',
          datajson: JSON.stringify(data),
          modifiedby: data.modifiedby,
        },
        trx,
      );

      await this.redisService.set(
        `${this.tableName}-page-${pageNumber}`,
        JSON.stringify(allFetchedData),
      );
      return {
        updatedItem: {
          id,
          ...data,
        },
        itemIndex: itemIndex.zeroBasedIndex < 0 ? 0 : itemIndex.zeroBasedIndex,
        pageNumber,
        fetchedPages,
        pagedData,
      };
    } catch (error) {
      console.error('Error updating Alat Bayar:', error);
      throw new Error('Failed to update Alat Bayar');
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
          postingdari: 'DELETE ALAT-BAYAR',
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

    worksheet.mergeCells('A1:G1');
    worksheet.mergeCells('A2:G2');
    worksheet.mergeCells('A3:G3');
    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN ALAT BAYAR';
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
      'STATUS LANGSUNG CAIR',
      'STATUS DEFAULT',
      'STATUS BANK',
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
        horizontal: index === 0 ? 'right' : 'center',
        vertical: 'middle',
      };
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
        row.statuslangsungcair_text,
        row.statusdefault_text,
        row.statusbank_text,
        row.text,
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

    const adjustCols = [5, 6, 7];
    adjustCols.forEach((colIndex) => {
      const col = worksheet.getColumn(colIndex);
      const currentWidth = col.width ?? 20;
      col.width = Math.max(10, currentWidth / 2);
    });

    worksheet.getColumn(1).width = 6;

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_alatbayar_${Date.now()}.xlsx`,
    );
    await workbook.xlsx.writeFile(tempFilePath);

    return tempFilePath;
  }
}
