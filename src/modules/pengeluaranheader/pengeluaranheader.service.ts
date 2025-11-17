import {
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePengeluaranheaderDto } from './dto/create-pengeluaranheader.dto';
import { UpdatePengeluaranheaderDto } from './dto/update-pengeluaranheader.dto';
import { FindAllParams } from 'src/common/interfaces/all.interface';
import { RedisService } from 'src/common/redis/redis.service';
import {
  formatDateToSQL,
  UtilsService,
  tandatanya,
  formatIndonesianNumber,
  parseNumberWithSeparators,
  formatIndonesianNegative,
} from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import { PengeluarandetailService } from '../pengeluarandetail/pengeluarandetail.service';
import { JurnalumumheaderService } from '../jurnalumumheader/jurnalumumheader.service';
import { GlobalService } from '../global/global.service';
import { LocksService } from '../locks/locks.service';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook, Column } from 'exceljs';
import { StatuspendukungService } from '../statuspendukung/statuspendukung.service';
import { PengeluaranemklheaderService } from '../pengeluaranemklheader/pengeluaranemklheader.service';
import { PenerimaanemklheaderService } from '../penerimaanemklheader/penerimaanemklheader.service';

@Injectable()
export class PengeluaranheaderService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly runningNumberService: RunningNumberService,
    private readonly pengeluarandetailService: PengeluarandetailService,
    private readonly JurnalumumheaderService: JurnalumumheaderService,
    private readonly statuspendukungService: StatuspendukungService,
    @Inject(forwardRef(() => PengeluaranemklheaderService)) // ← Index 7: Gunakan forwardRef di sini!
    private readonly pengeluaranemklheaderService: PengeluaranemklheaderService,
    private readonly penerimaanemklheaderService: PenerimaanemklheaderService,
  ) {}
  private readonly tableName = 'pengeluaranheader';
  async create(data: any, trx: any) {
    try {
      const nominalValue = 0;
      const positiveNominal = '';
      const insertData = {
        nobukti: data.nobukti ?? null,
        tglbukti: formatDateToSQL(String(data?.tglbukti)),
        relasi_id: data.relasi_id ?? null,
        keterangan: data.keterangan ?? null,
        bank_id: data.bank_id ?? null,
        postingdari: data.postingdari ?? null,
        coakredit: data.coakredit ?? null,
        dibayarke: data.dibayarke ?? null,
        alatbayar_id: data.alatbayar_id ?? null,
        nowarkat: data.nowarkat ?? null,
        tgljatuhtempo: formatDateToSQL(String(data?.tgljatuhtempo)),
        gantungorderan_nobukti: data.gantungorderan_nobukti ?? null,
        daftarbank_id: data.daftarbank_id ?? null,
        statusformat: data.statusformat ?? null,
        modifiedby: data.modifiedby ?? null,
        created_at: this.utilsService.getTime(),
        updated_at: this.utilsService.getTime(),
      };

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });

      const memoExpr = 'TRY_CONVERT(nvarchar(max), memo)';
      const parameterCabang = await trx('parameter')
        .select(trx.raw(`JSON_VALUE(${memoExpr}, '$.CABANG_ID') AS cabang_id`))
        .where('grp', 'CABANG')
        .andWhere('subgrp', 'CABANG')
        .first();

      const formatpengeluaran = await trx(`bank as b`)
        .select('p.grp', 'p.subgrp', 'b.formatpengeluaran', 'b.coa')
        .leftJoin('parameter as p', 'p.id', 'b.formatpengeluaran')
        .where('b.id', insertData.bank_id)
        .first();
      const parameter = await trx('parameter')
        .select(
          'grp',
          'subgrp',
          trx.raw(`JSON_VALUE(${memoExpr}, '$.MEMO') AS memo_nama`),
        )
        .where('id', formatpengeluaran.formatpengeluaran)
        .first();
      if (!formatpengeluaran) {
        throw new Error(`Bank dengan id ${insertData.bank_id} tidak ditemukan`);
      }

      if (!parameter) {
        throw new Error(
          `Parameter dengan id ${formatpengeluaran.formatpengeluaran} tidak ditemukan`,
        );
      }
      const cabangId = parameterCabang.cabang_id;
      const nomorBukti = await this.runningNumberService.generateRunningNumber(
        trx,
        parameter.grp,
        parameter.subgrp,
        this.tableName,
        String(insertData.tglbukti ?? ''),
        cabangId,
      );
      insertData.nobukti = nomorBukti;
      insertData.statusformat = formatpengeluaran
        ? formatpengeluaran.formatpengeluaran
        : null;
      insertData.postingdari = parameter ? parameter.memo_nama : null;

      const insertedItems = await trx(this.tableName)
        .insert(insertData)
        .returning('*');

      const dataPositif = await trx('parameter')
        .where('text', 'POSITIF')
        .andWhere('grp', 'NILAI PROSES')
        .first();
      const dataNegatif = await trx('parameter')
        .where('text', 'NEGATIF')
        .andWhere('grp', 'NILAI PROSES')
        .first();

      let nobukti_transaksilain = null;
      let penerimaanemklheader_nobukti = null;

      if (data.details.length > 0) {
        // Pisahkan details berdasarkan ada/tidaknya transaksilain_nobukti
        const detailsForPenerimaan = data.details.filter(
          (detail: any) =>
            detail.transaksilain_nobukti &&
            detail.transaksilain_nobukti.trim() !== '',
        );

        const detailsForPengeluaran = data.details.filter(
          (detail: any) =>
            !detail.transaksilain_nobukti ||
            detail.transaksilain_nobukti.trim() === '',
        );

        // ============ PROSES PENERIMAAN (yang ada transaksilain_nobukti) ============
        if (detailsForPenerimaan.length > 0) {
          // Filter hanya detail yang coadebet-nya ada di coaproses datapengeluaranemkl
          const validDetailsForPenerimaan: any[] = [];

          for (const detail of detailsForPenerimaan) {
            // Cari data pengeluaranemkl berdasarkan coadebet detail
            const datapengeluaranemkl = await trx('pengeluaranemkl')
              .where('coaproses', detail.coadebet)
              .first();

            // Hanya proses jika coadebet ada di coaproses
            if (datapengeluaranemkl) {
              // Validasi nilaiprosespenerimaan
              const statusPenerimaan =
                datapengeluaranemkl.nilaiprosespenerimaan;
              const nominalValue = parseNumberWithSeparators(detail.nominal);

              // Cek apakah nominal positif atau negatif
              const isPositif = !isNaN(nominalValue) && nominalValue > 0;
              const isNegatif = !isNaN(nominalValue) && nominalValue < 0;

              // Validasi: jika positif, status harus 171; jika negatif, status harus 172
              if (
                isPositif &&
                Number(statusPenerimaan) !== Number(dataPositif.id)
              ) {
                throw new Error(
                  `Error pada detail penerimaan dengan coadebet ${detail.coadebet}: Nominal positif harus memiliki nilaiprosespenerimaan 171 (POSITIF), tetapi mendapat ${statusPenerimaan}`,
                );
              }

              if (
                isNegatif &&
                Number(statusPenerimaan) !== Number(dataNegatif.id)
              ) {
                throw new Error(
                  `Error pada detail penerimaan dengan coadebet ${detail.coadebet}: Nominal negatif harus memiliki nilaiprosespenerimaan 172 (NEGATIF), tetapi mendapat ${statusPenerimaan}`,
                );
              }

              // Jika validasi lolos, masukkan ke array valid
              validDetailsForPenerimaan.push(detail);
            }
          }

          // Proses insert hanya jika ada detail yang valid
          if (validDetailsForPenerimaan.length > 0) {
            const detailPenerimaanEmkl = validDetailsForPenerimaan.map(
              (detail: any) => {
                const nominalValue = parseNumberWithSeparators(detail.nominal);
                const absoluteNominal = Math.abs(nominalValue)
                  .toFixed(0)
                  .toString();

                return {
                  id: 0,
                  keterangan: detail.keterangan ?? null,
                  nominal: absoluteNominal ?? null,
                  modifiedby: insertData.modifiedby ?? null,
                  pengeluaranemkl_nobukti: detail.transaksilain_nobukti ?? null,
                };
              },
            );
            const firstValidDetail = validDetailsForPenerimaan[0];
            const datapenerimaanemkl = await trx('penerimaanemkl')
              .where('coaproses', firstValidDetail.coadebet)
              .first();

            const payloadPenerimaanEmklHeader = {
              tglbukti: insertData.tglbukti ?? null,
              tgljatuhtempo: insertData.tgljatuhtempo ?? null,
              keterangan: insertData.keterangan ?? null,
              karyawan_id: data.karyawan_id ?? null,
              format: datapenerimaanemkl.format ?? null,
              coaproses: datapenerimaanemkl.coaproses ?? null,
              jenisposting: data.jenisposting ?? null,
              bank_id: insertData.bank_id ?? null,
              nowarkat: insertData.nowarkat ?? null,
              penerimaan_nobukti: null,
              pengeluaran_nobukti: nomorBukti ?? null,
              created_at: this.utilsService.getTime(),
              updated_at: this.utilsService.getTime(),
              modifiedby: insertData.modifiedby,
              details: detailPenerimaanEmkl,
            };

            const penerimaanemklheaderInserted =
              await this.penerimaanemklheaderService.create(
                payloadPenerimaanEmklHeader,
                trx,
              );
            penerimaanemklheader_nobukti =
              penerimaanemklheaderInserted.newItem.nobukti;
          }
        }

        // ============ PROSES PENGELUARAN (yang tidak ada transaksilain_nobukti) ============
        if (detailsForPengeluaran.length > 0) {
          // Filter hanya detail yang coadebet-nya ada di coaproses datapengeluaranemkl
          const validDetailsForPengeluaran: any[] = [];

          for (const detail of detailsForPengeluaran) {
            // Cari data pengeluaranemkl berdasarkan coadebet detail
            const datapengeluaranemkl = await trx('pengeluaranemkl')
              .where('coaproses', detail.coadebet)
              .first();

            // Hanya proses jika coadebet ada di coaproses
            if (datapengeluaranemkl) {
              // Validasi nilaiprosespengeluaran
              const statusPengeluaran =
                datapengeluaranemkl.nilaiprosespengeluaran;
              const nominalValue = parseNumberWithSeparators(detail.nominal);

              // Cek apakah nominal positif atau negatif
              const isPositif = !isNaN(nominalValue) && nominalValue > 0;
              const isNegatif = !isNaN(nominalValue) && nominalValue < 0;
              // Validasi: jika positif, status harus 171; jika negatif, status harus 172
              if (
                isPositif &&
                Number(statusPengeluaran) !== Number(dataPositif.id)
              ) {
                throw new Error(
                  `Error pada detail pengeluaran dengan coadebet ${detail.coadebet}: Nominal positif harus memiliki nilaiprosespengeluaran 171 (POSITIF), tetapi mendapat ${statusPengeluaran}`,
                );
              }

              if (
                isNegatif &&
                Number(statusPengeluaran) !== Number(dataNegatif.id)
              ) {
                throw new Error(
                  `Error pada detail pengeluaran dengan coadebet ${detail.coadebet}: Nominal negatif harus memiliki nilaiprosespengeluaran 172 (NEGATIF), tetapi mendapat ${statusPengeluaran}`,
                );
              }

              // Jika validasi lolos, masukkan ke array valid
              validDetailsForPengeluaran.push(detail);
            }
          }

          // Proses insert hanya jika ada detail yang valid
          if (validDetailsForPengeluaran.length > 0) {
            const detailPengeluaranEmkl = validDetailsForPengeluaran.map(
              (detail: any) => {
                const nominalValue = parseNumberWithSeparators(detail.nominal);
                const absoluteNominal = Math.abs(nominalValue)
                  .toFixed(0)
                  .toString();

                return {
                  id: 0,
                  keterangan: detail.keterangan ?? null,
                  nominal: absoluteNominal ?? null,
                  modifiedby: insertData.modifiedby ?? null,
                };
              },
            );

            // Ambil data pengeluaranemkl pertama dari detail yang valid
            const firstValidDetail = validDetailsForPengeluaran[0];
            const datapengeluaranemklForInsert = await trx('pengeluaranemkl')
              .where('coaproses', firstValidDetail.coadebet)
              .first();
            const payloadPengeluaranEmklHeader = {
              tglbukti: insertData.tglbukti ?? null,
              coaproses: datapengeluaranemklForInsert.coaproses ?? null,
              tgljatuhtempo: insertData.tgljatuhtempo ?? null,
              keterangan: insertData.keterangan ?? null,
              karyawan_id: data.karyawan_id ?? null,
              jenisposting: data.jenisposting ?? null,
              bank_id: insertData.bank_id ?? null,
              nowarkat: insertData.nowarkat ?? null,
              pengeluaran_nobukti: nomorBukti ?? null,
              created_at: this.utilsService.getTime(),
              updated_at: this.utilsService.getTime(),
              modifiedby: insertData.modifiedby,
              details: detailPengeluaranEmkl,
            };
            const pengeluaranemklheaderInserted =
              await this.pengeluaranemklheaderService.create(
                payloadPengeluaranEmklHeader,
                trx,
              );
            nobukti_transaksilain =
              pengeluaranemklheaderInserted.newItem.nobukti;
          }
        }
      }

      if (data.details.length >= 0) {
        const detailsWithNobukti = data.details.map(
          ({
            coadebet_text,
            tglinvoiceemkl,
            transaksibiaya_nobukti,
            transaksilain_nobukti,
            ...detail
          }: any) => ({
            ...detail,
            nobukti: nomorBukti,
            tglinvoiceemkl: formatDateToSQL(tglinvoiceemkl),
            modifiedby: data.modifiedby || null,
            transaksilain_nobukti:
              nobukti_transaksilain || penerimaanemklheader_nobukti,
            transaksibiaya_nobukti: transaksilain_nobukti,
          }),
        );
        await this.pengeluarandetailService.create(
          detailsWithNobukti,
          insertedItems[0].id,
          trx,
        );
      }

      const newItem = insertedItems[0];
      const processDetails = (details) => {
        return details.flatMap((detail) => [
          {
            id: 0,
            coa: detail.coadebet,
            nobukti: nomorBukti,
            tglbukti: formatDateToSQL(insertData.tglbukti),
            keterangan: detail.keterangan,
            nominaldebet: positiveNominal ? positiveNominal : detail.nominal,
            nominalkredit: '',
            modifiedby: insertData.modifiedby,
          },
          {
            id: 0,
            coa: formatpengeluaran?.coa || null,
            nobukti: nomorBukti,
            tglbukti: formatDateToSQL(insertData.tglbukti),
            keterangan: detail.keterangan,
            nominaldebet: '',
            nominalkredit: positiveNominal ? positiveNominal : detail.nominal,
            modifiedby: insertData.modifiedby,
          },
        ]);
      };
      const result = processDetails(data.details);
      const jurnalPayload = {
        nobukti: nomorBukti,
        tglbukti: insertData.tglbukti,
        postingdari: insertData.postingdari,
        statusformat: insertData.statusformat,
        keterangan: insertData.keterangan,
        created_at: this.utilsService.getTime(),
        updated_at: this.utilsService.getTime(),
        modifiedby: insertData.modifiedby,
        details: result,
      };

      const jurnalHeaderInserted = await this.JurnalumumheaderService.create(
        jurnalPayload,
        trx,
      );

      const { data: filteredItems } = await this.findAll(
        {
          search: data.search,
          filters: data.filters,
          pagination: { page: data.page, limit: 0 },
          sort: { sortBy: data.sortBy, sortDirection: data.sortDirection },
          isLookUp: false,
        },
        trx,
      );

      let itemIndex = filteredItems.findIndex(
        (item) => Number(item.id) === Number(newItem.id),
      );

      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const pageNumber = Math.floor(itemIndex / data.limit) + 1;
      const endIndex = pageNumber * data.limit;

      const limitedItems = filteredItems.slice(0, endIndex);

      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.statuspendukungService.create(
        this.tableName,
        newItem.id,
        insertData.modifiedby,
        trx,
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: `ADD PENGELUARAN HEADER`,
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
      console.log(error, 'error di pengeluaran header');
      throw new Error(`Error: ${error}`);
    }
  }

  async findAll(
    { search, filters, pagination, sort, isLookUp }: FindAllParams,
    trx: any,
  ) {
    try {
      let { page, limit } = pagination ?? {};

      page = page ?? 1;
      limit = limit ?? 0;

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

      const tempUrl = `##temp_url_${Math.random().toString(36).substring(2, 8)}`;

      await trx.schema.createTable(tempUrl, (t) => {
        t.integer('id').nullable();
        t.string('nobukti').nullable();
        t.text('link').nullable();
      });
      const url = 'jurnalumumheader';

      await trx(tempUrl).insert(
        trx
          .select(
            'u.id',
            'u.nobukti',
            trx.raw(`
                    STRING_AGG(
                      '<a target="_blank" className="link-color" href="/dashboard/${url}' + ${tandatanya} + 'nobukti=' + u.nobukti + '">' +
                      '<HighlightWrapper value="' + u.nobukti + '" />' +
                      '</a>', ','
                    ) AS link
                  `),
          )
          .from(this.tableName + ' as u')
          .groupBy('u.id', 'u.nobukti'),
      );

      const query = trx
        .from(trx.raw(`${this.tableName} as u WITH (READUNCOMMITTED)`))
        .select([
          'u.id as id',
          'u.nobukti',
          trx.raw("FORMAT(u.tglbukti, 'dd-MM-yyyy') as tglbukti"),
          'u.relasi_id',
          'u.keterangan',
          'u.bank_id',
          'u.postingdari',
          'u.coakredit',
          'u.dibayarke',
          'u.alatbayar_id',
          'u.nowarkat',
          trx.raw("FORMAT(u.tgljatuhtempo, 'dd-MM-yyyy') as tgljatuhtempo"),
          'u.gantungorderan_nobukti',
          'u.daftarbank_id',
          'u.statusformat',
          'u.modifiedby',
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'r.nama as relasi_text',
          'b.nama as bank_text',
          'a.keterangancoa as coakredit_text',
          'c.nama as alatbayar_text',
          'd.nama as daftarbank_text',
          'tempUrl.link',
        ])
        .leftJoin(
          trx.raw(`${tempUrl} as tempUrl`),
          'u.nobukti',
          'tempUrl.nobukti',
        )
        .leftJoin(
          trx.raw('relasi as r WITH (READUNCOMMITTED)'),
          'u.relasi_id',
          'r.id',
        )
        .leftJoin(
          trx.raw('bank as b WITH (READUNCOMMITTED)'),
          'u.bank_id',
          'b.id',
        )
        .leftJoin(
          trx.raw('akunpusat as a WITH (READUNCOMMITTED)'),
          'u.coakredit',
          'a.coa',
        )
        .leftJoin(
          trx.raw('alatbayar as c WITH (READUNCOMMITTED)'),
          'u.alatbayar_id',
          'c.id',
        )
        .leftJoin(
          trx.raw('daftarbank as d WITH (READUNCOMMITTED)'),
          'u.daftarbank_id',
          'd.id',
        );

      if (filters?.tglDari && filters?.tglSampai) {
        const tglDariFormatted = formatDateToSQL(String(filters?.tglDari));
        const tglSampaiFormatted = formatDateToSQL(String(filters?.tglSampai));
        query.whereBetween('u.tglbukti', [
          tglDariFormatted,
          tglSampaiFormatted,
        ]);
      }

      const excludeSearchKeys = [
        'tglDari',
        'tglSampai',
        'relasi_id',
        'bank_id',
        'alatbayar_id',
        'daftarbank_id',
      ];

      const searchFields = Object.keys(filters || {}).filter(
        (k) => !excludeSearchKeys.includes(k),
      );

      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      if (search) {
        const sanitizedValue = String(search).replace(/\[/g, '[[]').trim();

        query.where((qb) => {
          searchFields.forEach((field) => {
            if (
              [
                'created_at',
                'updated_at',
                'tglbukti',
                'tgljatuhtempo',
              ].includes(field)
            ) {
              qb.orWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
                field,
                `%${sanitizedValue}%`,
              ]);
            } else if (field === 'relasi_text') {
              qb.orWhere('r.nama', 'like', `%${sanitizedValue}%`);
            } else if (field === 'bank_text') {
              qb.orWhere('b.nama', 'like', `%${sanitizedValue}%`);
            } else if (field === 'coakredit_text') {
              qb.orWhere('a.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (field === 'alatbayar_text') {
              qb.orWhere('c.nama', 'like', `%${sanitizedValue}%`);
            } else if (field === 'daftarbank_text') {
              qb.orWhere('d.nama', 'like', `%${sanitizedValue}%`);
            } else {
              qb.orWhere(`u.${field}`, 'like', `%${sanitizedValue}%`);
            }
          });
        });
      }

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (key === 'tglDari' || key === 'tglSampai') {
            continue;
          }

          if (value) {
            const sanitizedValue = String(value).replace(/\[/g, '[[]');

            if (
              [
                'created_at',
                'updated_at',
                'tglbukti',
                'tgljatuhtempo',
              ].includes(key)
            ) {
              query.andWhereRaw("FORMAT(u.??, 'dd-MM-yyyy HH:mm:ss') LIKE ?", [
                key,
                `%${sanitizedValue}%`,
              ]);
            } else if (key === 'relasi_text') {
              query.orWhere('r.nama', 'like', `%${sanitizedValue}%`);
            } else if (key === 'bank_text') {
              query.orWhere('b.nama', 'like', `%${sanitizedValue}%`);
            } else if (key === 'coakredit_text') {
              query.orWhere('a.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (key === 'alatbayar_text') {
              query.orWhere('c.nama', 'like', `%${sanitizedValue}%`);
            } else if (key === 'daftarbank_text') {
              query.orWhere('d.nama', 'like', `%${sanitizedValue}%`);
            } else {
              query.orWhere(`u.${key}`, 'like', `%${sanitizedValue}%`);
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

  async findOne(id: string, trx: any) {
    try {
      const query = trx
        .from(trx.raw(`${this.tableName} as u WITH (READUNCOMMITTED)`))
        .select([
          'u.id as id',
          'u.nobukti',
          trx.raw("FORMAT(u.tglbukti, 'dd-MM-yyyy') as tglbukti"),
          'u.relasi_id',
          'u.keterangan',
          'u.bank_id',
          'u.postingdari',
          'u.coakredit',
          'u.dibayarke',
          'u.alatbayar_id',
          'u.nowarkat',
          trx.raw("FORMAT(u.tgljatuhtempo, 'dd-MM-yyyy') as tgljatuhtempo"),
          'u.gantungorderan_nobukti',
          'u.daftarbank_id',
          'u.statusformat',
          'u.modifiedby',
          trx.raw("FORMAT(u.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(u.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'r.nama as relasi_text',
          'b.nama as bank_text',
          'a.keterangancoa as coakredit_text',
          'c.nama as alatbayar_text',
          'd.nama as daftarbank_text',
        ])
        .leftJoin(
          trx.raw('relasi as r WITH (READUNCOMMITTED)'),
          'u.relasi_id',
          'r.id',
        )
        .leftJoin(
          trx.raw('bank as b WITH (READUNCOMMITTED)'),
          'u.bank_id',
          'b.id',
        )
        .leftJoin(
          trx.raw('akunpusat as a WITH (READUNCOMMITTED)'),
          'u.coakredit',
          'a.coa',
        )
        .leftJoin(
          trx.raw('alatbayar as c WITH (READUNCOMMITTED)'),
          'u.alatbayar_id',
          'c.id',
        )
        .leftJoin(
          trx.raw('daftarbank as d WITH (READUNCOMMITTED)'),
          'u.daftarbank_id',
          'd.id',
        )
        .where('u.id', id);
      const data = await query;

      return {
        data: data,
      };
    } catch (error) {
      console.error('Error fetching data:', error);
      throw new Error('Failed to fetch data');
    }
  }

  async update(id: any, data: any, trx: any) {
    try {
      data.tglbukti = formatDateToSQL(String(data?.tglbukti));
      data.tgljatuhtempo = formatDateToSQL(String(data?.tgljatuhtempo));

      const {
        sortBy,
        sortDirection,
        filters,
        search,
        page,
        limit,
        relasi_text,
        bank_text,
        alatbayar_text,
        daftarbank_text,
        coakredit_text,
        details,
        ...insertData
      } = data;

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });

      const existingData = await trx(this.tableName).where('id', id).first();
      if (!existingData) {
        throw new Error(`Pengeluaran dengan id ${id} tidak ditemukan`);
      }

      // Get format pengeluaran untuk COA kredit
      const formatpengeluaran = await trx(`bank as b`)
        .select('p.grp', 'p.subgrp', 'b.formatpengeluaran', 'b.coa')
        .leftJoin('parameter as p', 'p.id', 'b.formatpengeluaran')
        .where('b.id', insertData.bank_id || existingData.bank_id)
        .first();

      const hasChanges = this.utilsService.hasChanges(insertData, existingData);

      if (hasChanges) {
        insertData.updated_at = this.utilsService.getTime();
        await trx(this.tableName).where('id', id).update(insertData);
      }

      // Handle detail updates
      if (details && details.length > 0) {
        const nobuktiHeader = insertData.nobukti || existingData.nobukti;
        const cleanedDetails = details.map(
          ({ coadebet_text, tglinvoiceemkl, ...rest }) => ({
            ...rest,
            nobukti: nobuktiHeader,
            tglinvoiceemkl: formatDateToSQL(tglinvoiceemkl),
            modifiedby: insertData.modifiedby || existingData.modifiedby,
          }),
        );

        await this.pengeluarandetailService.create(cleanedDetails, id, trx);
      }

      // Update jurnal jika ada perubahan
      if (hasChanges || (details && details.length > 0)) {
        const updatedData = { ...existingData, ...insertData };
        const nobukti = updatedData.nobukti;

        // Process details untuk jurnal
        const processDetails = (details) => {
          return details.flatMap((detail) => [
            {
              id: 0, // Set 0 untuk update, service akan handle existing ID
              coa: detail.coadebet,
              nobukti: nobukti,
              tglbukti: formatDateToSQL(updatedData.tglbukti),
              keterangan: detail.keterangan,
              nominaldebet: detail.nominal,
              nominalkredit: '',
              modifiedby: updatedData.modifiedby,
            },
            {
              id: 0, // Set 0 untuk update, service akan handle existing ID
              coa: formatpengeluaran?.coa || null,
              nobukti: nobukti,
              tglbukti: formatDateToSQL(updatedData.tglbukti),
              keterangan: detail.keterangan,
              nominaldebet: '',
              nominalkredit: detail.nominal,
              modifiedby: updatedData.modifiedby,
            },
          ]);
        };

        const jurnalDetails = processDetails(details || []);

        // Cari jurnal header yang existing berdasarkan nobukti
        const existingJurnal = await trx('jurnalumumheader')
          .where('nobukti', nobukti)
          .first();

        if (existingJurnal) {
          // Update existing jurnal
          const jurnalUpdatePayload = {
            nobukti: nobukti,
            tglbukti: updatedData.tglbukti,
            postingdari: updatedData.postingdari,
            statusformat: updatedData.statusformat,
            keterangan: updatedData.keterangan,
            updated_at: this.utilsService.getTime(),
            modifiedby: updatedData.modifiedby,
            details: jurnalDetails,
          };

          await this.JurnalumumheaderService.update(
            existingJurnal.id,
            jurnalUpdatePayload,
            trx,
          );
        } else {
          // Create new jurnal jika tidak ada (fallback)
          const jurnalCreatePayload = {
            nobukti: nobukti,
            tglbukti: updatedData.tglbukti,
            postingdari: updatedData.postingdari,
            statusformat: updatedData.statusformat,
            keterangan: updatedData.keterangan,
            created_at: this.utilsService.getTime(),
            updated_at: this.utilsService.getTime(),
            modifiedby: updatedData.modifiedby,
            details: jurnalDetails,
          };

          await this.JurnalumumheaderService.create(jurnalCreatePayload, trx);
        }
      }

      const { data: filteredItems } = await this.findAll(
        {
          search,
          filters,
          pagination: { page, limit: 0 },
          sort: { sortBy, sortDirection },
          isLookUp: false,
        },
        trx,
      );

      let itemIndex = filteredItems.findIndex((item) => Number(item.id) === id);
      if (itemIndex === -1) {
        itemIndex = 0;
      }

      const pageNumber = Math.floor(itemIndex / limit) + 1;
      const endIndex = pageNumber * limit;
      const limitedItems = filteredItems.slice(0, endIndex);

      await this.redisService.set(
        `${this.tableName}-allItems`,
        JSON.stringify(limitedItems),
      );

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: `EDIT PENGELUARAN HEADER`,
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
      console.error('Error in pengeluaran update:', error);
      throw new Error(`Error: ${error.message}`);
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
      const deletedDataDetail = await this.utilsService.lockAndDestroy(
        id,
        'pengeluarandetail',
        'pengeluaran_id',
        trx,
      );
      await this.statuspendukungService.remove(id, modifiedby, trx);

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: 'DELETE PENGELUARAN DETAIL',
          idtrans: deletedDataDetail.id,
          nobuktitrans: deletedDataDetail.id,
          aksi: 'DELETE',
          datajson: JSON.stringify(deletedDataDetail),
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

  async exportToExcel(data: any[], trx: any) {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Data Export');

    // Header laporan
    worksheet.mergeCells('A1:D1'); // Ubah dari E1 ke D1 karena hanya 4 kolom
    worksheet.mergeCells('A2:D2'); // Ubah dari E2 ke D2 karena hanya 4 kolom
    worksheet.mergeCells('A3:D3'); // Ubah dari E3 ke D3 karena hanya 4 kolom

    worksheet.getCell('A1').value = 'PT. TRANSPORINDO AGUNG SEJAHTERA';
    worksheet.getCell('A2').value = 'LAPORAN PENGELUARAN';
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

    let currentRow = 5;

    for (const h of data) {
      const detailRes = await this.pengeluarandetailService.findAll(
        {
          filters: {
            nobukti: h.nobukti,
          },
        },
        trx,
      );
      const details = detailRes.data ?? [];

      const headerInfo = [
        ['No Bukti', h.nobukti ?? ''],
        ['Tanggal', h.tglbukti ?? ''],
        ['Bank / Kas', h.bank_text ?? ''],
        ['Tanggal Kas', h.tgljatuhtempo ?? ''],
        ['Relasi', h.relasi_text ?? ''],
      ];

      // Merge kolom A dan B untuk seluruh area header info
      const headerStartRow = currentRow;
      const headerEndRow = currentRow + headerInfo.length - 1;

      headerInfo.forEach(([label, value]) => {
        worksheet.getCell(`A${currentRow}`).value = label;
        worksheet.getCell(`A${currentRow}`).font = {
          bold: true,
          name: 'Tahoma',
          size: 10,
        };
        worksheet.getCell(`C${currentRow}`).value = value;
        worksheet.getCell(`C${currentRow}`).font = {
          name: 'Tahoma',
          size: 10,
        };
        currentRow++;
      });

      for (let row = headerStartRow; row <= headerEndRow; row++) {
        worksheet.mergeCells(`A${row}:B${row}`);
      }

      currentRow++;

      if (details.length > 0) {
        const tableHeaders = ['NO.', 'NAMA PERKIRAAN', 'KETERANGAN', 'NOMINAL'];

        tableHeaders.forEach((header, index) => {
          const cell = worksheet.getCell(currentRow, index + 1);
          cell.value = header;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF00' },
          };
          cell.font = {
            bold: true,
            name: 'Tahoma',
            size: 10,
          };
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
        currentRow++;

        details.forEach((d: any, detailIndex: number) => {
          const rowValues = [
            detailIndex + 1,
            d.coadebet_text ?? '',
            d.keterangan ?? '',
            d.nominal ?? 0,
          ];

          rowValues.forEach((value, colIndex) => {
            const cell = worksheet.getCell(currentRow, colIndex + 1);
            cell.value = value;
            cell.font = {
              name: 'Tahoma',
              size: 10,
            };

            if (colIndex === 3) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else if (colIndex === 0) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }

            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          });
          currentRow++;
        });

        const totalNominal = details.reduce(
          (sum: number, d: any) => sum + (Number(d.nominal) || 0),
          0,
        );

        const totalLabelCell = worksheet.getCell(currentRow, 3);
        totalLabelCell.value = 'TOTAL';
        totalLabelCell.font = { bold: true, name: 'Tahoma', size: 10 };
        totalLabelCell.alignment = { horizontal: 'left', vertical: 'middle' };
        totalLabelCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        const totalValueCell = worksheet.getCell(currentRow, 4);
        totalValueCell.value = totalNominal;
        totalValueCell.font = { bold: true, name: 'Tahoma', size: 10 };
        totalValueCell.alignment = { horizontal: 'right', vertical: 'middle' };
        totalValueCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        currentRow++;
      }
    }

    worksheet.getColumn(1).width = 6;

    worksheet.getColumn(2).width = 35;

    worksheet.getColumn(3).width = 25;

    worksheet.getColumn(4).width = 15;

    const tempDir = path.resolve(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempFilePath = path.resolve(
      tempDir,
      `laporan_pengeluaran${Date.now()}.xlsx`,
    );

    await workbook.xlsx.writeFile(tempFilePath);
    return tempFilePath;
  }
}
