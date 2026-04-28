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
import {
  calculateItemIndex,
  extractFetchedPageData,
  formatDateToSQL,
  getFetchedPages,
  splitDataByPages,
  UtilsService,
} from 'src/utils/utils.service';
import { RedisService } from 'src/common/redis/redis.service';
import { RelasiService } from '../relasi/relasi.service';
import * as fs from 'fs';
import * as path from 'path';
import { Workbook, Column } from 'exceljs';
import * as dotenv from 'dotenv';

import { StatuspendukungService } from '../statuspendukung/statuspendukung.service';
dotenv.config();

@Injectable()
export class ShipperService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
    private readonly statuspendukungService: StatuspendukungService,
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
      console.log('masukkkk22112');
      insertData.updated_at = this.utilsService.getTime();
      insertData.created_at = this.utilsService.getTime();
      insertData.tglemailshipperjobminus = formatDateToSQL(
        String(insertData?.tglemailshipperjobminus),
      );
      insertData.tgllahir = formatDateToSQL(String(insertData?.tgllahir));

      Object.keys(insertData).forEach((key) => {
        if (typeof insertData[key] === 'string') {
          insertData[key] = insertData[key].toUpperCase();
        }
      });

      const insertedItems = await trx(this.tableName).insert(insertData);
      const newItem = await trx(this.tableName).orderBy('id', 'desc').first();
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

      await trx(this.tableName)
        .update({
          relasi_id: Number(dataRelasi.id),
          statusrelasi: statusRelasi.id,
        })
        .where('id', newItem.id);

      await this.statuspendukungService.create(
        this.tableName,
        newItem.id,
        insertData.modifiedby,
        trx,
      );

      let posisi = 0;
      let totalItems = 0;
      const LastId = await trx(this.tableName)
        .select('id')
        .orderBy('id', 'desc')
        .first();
      const resultposition = await trx('vtemp')
        .count('* as posisi')
        .where(
          sortBy,
          sortDirection === 'desc' ? '>=' : '<=',
          insertData[sortBy],
        )
        .where('id', '<=', LastId?.id)
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

      // Log trail
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

      // Cache data per page ke Redis
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
      throw new Error(`Error creating SHIPPER: ${error.message}`);
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

      // Helper function untuk apply filters yang sama
      const applyFilters = (query: any) => {
        // Apply search filter
        if (search && search.trim()) {
          const sanitizedSearch = String(search)
            .replace(/[[\]%_]/g, '[$&]')
            .trim();

          query.where((qb) => {
            // Search semua kolom text
            qb.orWhere('s.nama', 'like', `%${sanitizedSearch}%`)
              .orWhere('s.keterangan', 'like', `%${sanitizedSearch}%`)
              .orWhere('s.contactperson', 'like', `%${sanitizedSearch}%`)
              .orWhere('s.alamat', 'like', `%${sanitizedSearch}%`)
              .orWhere('s.kota', 'like', `%${sanitizedSearch}%`)
              .orWhere('s.kodepos', 'like', `%${sanitizedSearch}%`)
              .orWhere('s.telp', 'like', `%${sanitizedSearch}%`)
              .orWhere('s.email', 'like', `%${sanitizedSearch}%`)
              .orWhere('s.npwp', 'like', `%${sanitizedSearch}%`)
              .orWhere('s.grup', 'like', `%${sanitizedSearch}%`)
              .orWhere('s.initial', 'like', `%${sanitizedSearch}%`)
              .orWhere('s.tipe', 'like', `%${sanitizedSearch}%`);

            // Search pada kolom tanggal
            qb.orWhereRaw("FORMAT(s.tgllahir, 'dd-MM-yyyy') like ?", [
              `%${sanitizedSearch}%`,
            ])
              .orWhereRaw(
                "FORMAT(s.created_at, 'dd-MM-yyyy HH:mm:ss') like ?",
                [`%${sanitizedSearch}%`],
              )
              .orWhereRaw(
                "FORMAT(s.updated_at, 'dd-MM-yyyy HH:mm:ss') like ?",
                [`%${sanitizedSearch}%`],
              );

            // Search pada kolom numerik jika search berupa angka
            const numericSearch = Number(sanitizedSearch);
            if (!isNaN(numericSearch)) {
              qb.orWhere('s.id', numericSearch)
                .orWhere('s.coa', numericSearch)
                .orWhere('s.marketing_id', numericSearch);
            }
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

            // Cek apakah kolom tanggal
            if (['tgllahir', 'tglemailshipperjobminus'].includes(key)) {
              query.andWhereRaw("FORMAT(s.??, 'dd-MM-yyyy') like ?", [
                key,
                `%${sanitizedValue}%`,
              ]);
            }
            // Cek apakah kolom timestamp
            else if (['created_at', 'updated_at'].includes(key)) {
              query.andWhereRaw("FORMAT(s.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
                key,
                `%${sanitizedValue}%`,
              ]);
            }
            // Cek apakah kolom numerik
            else {
              const numValue = Number(rawValue);
              if (!isNaN(numValue) && /^\d+$/.test(String(rawValue).trim())) {
                query.andWhere(`s.${key}`, numValue);
              } else {
                query.andWhere(`s.${key}`, 'like', `%${sanitizedValue}%`);
              }
            }
          });
        }

        return query;
      };

      // Determine sort column and direction
      const sortBy = sort?.sortBy || 'creditlimit';
      const sortDirection =
        sort?.sortDirection?.toLowerCase() === 'asc' ? 'asc' : 'desc';

      // Count query untuk total records
      const countQuery = trx('shipper as s');
      applyFilters(countQuery);
      const countResult = await countQuery.count('s.id as total').first();
      const total = Number(countResult?.total || 0);

      const query = trx('vshippertest as s').select([
        's.id',
        's.statusrelasi',
        's.relasi_id',
        's.nama',
        's.keterangan',
        's.contactperson',
        's.alamat',
        's.coa',
        's.coapiutang',
        's.coahutang',
        's.kota',
        's.kodepos',
        's.telp',
        's.email',
        's.fax',
        's.web',
        's.creditlimit',
        's.creditterm',
        's.credittermplus',
        's.npwp',
        's.coagiro',
        's.ppn',
        's.titipke',
        's.ppnbatalmuat',
        's.grup',
        's.formatdeliveryreport',
        's.comodity',
        's.namashippercetak',
        's.formatcetak',
        's.marketing_id',
        's.blok',
        's.nomor',
        's.rt',
        's.rw',
        's.kelurahan',
        's.kabupaten',
        's.kecamatan',
        's.propinsi',
        's.isdpp10psn',
        's.usertracing',
        's.passwordtracing',
        's.kodeprospek',
        's.namashipperprospek',
        's.emaildelay',
        's.keterangan1barisinvoice',
        's.nik',
        's.namaparaf',
        's.saldopiutang',
        's.keteranganshipperjobminus',
        's.tglemailshipperjobminus',
        's.tgllahir',
        's.idshipperasal',
        's.initial',
        's.tipe',
        's.idtipe',
        's.idinitial',
        's.nshipperprospek',
        's.parentshipper_id',
        's.npwpnik',
        's.nitku',
        's.kodepajak',
        's.statusaktif',
        's.info',
        's.modifiedby',
        's.created_at',
        's.updated_at',
      ]);

      applyFilters(query);
      query.orderBy(`s.${sortBy}`, sortDirection);
      if (sortBy !== 'id') {
        query.orderBy('s.id', 'asc');
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
      console.error('Error in findAll Shipper:', error);
      throw new Error(`Failed to fetch shipper data: ${error.message}`);
    }
  }

  // Helper method untuk build WHERE clause
  private buildWhereClause(search: string | undefined, filters: any): string {
    const conditions: string[] = [];

    // Apply search filter
    if (search && search.trim()) {
      const sanitizedSearch = String(search)
        .replace(/[[\]%_]/g, '[$&]')
        .replace(/'/g, "''")
        .trim();

      const searchConditions = [
        `s.nama LIKE '%${sanitizedSearch}%'`,
        `s.keterangan LIKE '%${sanitizedSearch}%'`,
        `s.contactperson LIKE '%${sanitizedSearch}%'`,
        `s.alamat LIKE '%${sanitizedSearch}%'`,
        `s.kota LIKE '%${sanitizedSearch}%'`,
        `s.kodepos LIKE '%${sanitizedSearch}%'`,
        `s.telp LIKE '%${sanitizedSearch}%'`,
        `s.email LIKE '%${sanitizedSearch}%'`,
        `s.npwp LIKE '%${sanitizedSearch}%'`,
        `s.grup LIKE '%${sanitizedSearch}%'`,
        `s.initial LIKE '%${sanitizedSearch}%'`,
        `s.tipe LIKE '%${sanitizedSearch}%'`,
        `FORMAT(s.tgllahir, 'dd-MM-yyyy') LIKE '%${sanitizedSearch}%'`,
        `FORMAT(s.created_at, 'dd-MM-yyyy HH:mm:ss') LIKE '%${sanitizedSearch}%'`,
        `FORMAT(s.updated_at, 'dd-MM-yyyy HH:mm:ss') LIKE '%${sanitizedSearch}%'`,
      ];

      const numericSearch = Number(sanitizedSearch);
      if (!isNaN(numericSearch)) {
        searchConditions.push(
          `s.id = ${numericSearch}`,
          `s.coa = ${numericSearch}`,
          `s.marketing_id = ${numericSearch}`,
        );
      }

      conditions.push(`(${searchConditions.join(' OR ')})`);
    }

    // Apply filters
    if (filters && Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([key, rawValue]) => {
        if (rawValue === null || rawValue === undefined || rawValue === '') {
          return;
        }

        const sanitizedValue = String(rawValue)
          .replace(/[[\]%_]/g, '[$&]')
          .replace(/'/g, "''");

        if (['tgllahir', 'tglemailshipperjobminus'].includes(key)) {
          conditions.push(
            `FORMAT(s.${key}, 'dd-MM-yyyy') LIKE '%${sanitizedValue}%'`,
          );
        } else if (['created_at', 'updated_at'].includes(key)) {
          conditions.push(
            `FORMAT(s.${key}, 'dd-MM-yyyy HH:mm:ss') LIKE '%${sanitizedValue}%'`,
          );
        } else {
          const numValue = Number(rawValue);
          if (!isNaN(numValue) && /^\d+$/.test(String(rawValue).trim())) {
            conditions.push(`s.${key} = ${numValue}`);
          } else {
            conditions.push(`s.${key} LIKE '%${sanitizedValue}%'`);
          }
        }
      });
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }
  async tempStatusPendukung(trx: any, tablename: string) {
    try {
      const tempStatusPendukung = `##temp_${Math.random().toString(36).substring(2, 15)}`;
      const tempData = `##temp_data${Math.random().toString(36).substring(2, 15)}`;
      const tempHasil = `##temp_hasil${Math.random().toString(36).substring(2, 15)}`;

      await trx.schema.createTable(tempStatusPendukung, (t) => {
        t.bigInteger('id').nullable();
        t.bigInteger('statusdatapendukung').nullable();
        t.bigInteger('transaksi_id').nullable();
        t.string('statuspendukung').nullable();
        t.text('keterangan').nullable();
        t.string('modifiedby').nullable();
        t.string('updated_at').nullable();
        t.string('created_at').nullable();
      });

      await trx.schema.createTable(tempData, (t) => {
        t.bigInteger('id').nullable();
        t.text('keterangan').nullable();
        t.string('judul').nullable();
      });

      await trx.schema.createTable(tempHasil, (t) => {
        t.bigInteger('id').nullable();
        t.text('statustidakasuransi').nullable();
        t.text('statustidakasuransi_nama').nullable();
        t.text('statustidakasuransi_memo').nullable();
        t.text('asuransi_tas').nullable();
        t.text('asuransi_tas_nama').nullable();
        t.text('asuransi_tas_memo').nullable();
        t.text('top_field').nullable();
        t.text('top_field_nama').nullable();
        t.text('top_field_memo').nullable();
        t.text('open_field').nullable();
        t.text('open_field_nama').nullable();
        t.text('open_field_memo').nullable();
        t.text('bongkaran').nullable();
        t.text('bongkaran_nama').nullable();
        t.text('bongkaran_memo').nullable();
        t.text('delivery_report').nullable();
        t.text('delivery_report_nama').nullable();
        t.text('delivery_report_memo').nullable();
        t.text('final_asuransi_bulan').nullable();
        t.text('final_asuransi_bulan_nama').nullable();
        t.text('final_asuransi_bulan_memo').nullable();
        t.text('job_banyak_invoice').nullable();
        t.text('job_banyak_invoice_nama').nullable();
        t.text('job_banyak_invoice_memo').nullable();
        t.text('job_pajak').nullable();
        t.text('job_pajak_nama').nullable();
        t.text('job_pajak_memo').nullable();
        t.text('cetak_keterangan_shipper').nullable();
        t.text('cetak_keterangan_shipper_nama').nullable();
        t.text('cetak_keterangan_shipper_memo').nullable();
        t.text('fumigasi').nullable();
        t.text('fumigasi_nama').nullable();
        t.text('fumigasi_memo').nullable();
        t.text('adjust_tagih_warkat').nullable();
        t.text('adjust_tagih_warkat_nama').nullable();
        t.text('adjust_tagih_warkat_memo').nullable();
        t.text('job_non_ppn').nullable();
        t.text('job_non_ppn_nama').nullable();
        t.text('job_non_ppn_memo').nullable();
        t.text('approval_pajakp_pisah_ongkos').nullable();
        t.text('approval_pajakp_pisah_ongkos_nama').nullable();
        t.text('approval_pajakp_pisah_ongkos_memo').nullable();
        t.text('decimal_invoice').nullable();
        t.text('decimal_invoice_nama').nullable();
        t.text('decimal_invoice_memo').nullable();
        t.text('reimbursement').nullable();
        t.text('reimbursement_nama').nullable();
        t.text('reimbursement_memo').nullable();
        t.text('not_invoice_tambahan').nullable();
        t.text('not_invoice_tambahan_nama').nullable();
        t.text('not_invoice_tambahan_memo').nullable();
        t.text('invoice_jasa_pengurusan_transportasi').nullable();
        t.text('invoice_jasa_pengurusan_transportasi_nama').nullable();
        t.text('invoice_jasa_pengurusan_transportasi_memo').nullable();
        t.text('not_ucase_shipper').nullable();
        t.text('not_ucase_shipper_nama').nullable();
        t.text('not_ucase_shipper_memo').nullable();
        t.text('shipper_sttb').nullable();
        t.text('shipper_sttb_nama').nullable();
        t.text('shipper_sttb_memo').nullable();
        t.text('shipper_cabang').nullable();
        t.text('shipper_cabang_nama').nullable();
        t.text('shipper_cabang_memo').nullable();
        t.text('spk').nullable();
        t.text('spk_nama').nullable();
        t.text('spk_memo').nullable();
        t.text('ppn_warkat_eksport').nullable();
        t.text('ppn_warkat_eksport_nama').nullable();
        t.text('ppn_warkat_eksport_memo').nullable();
        t.text('ppn_11').nullable();
        t.text('ppn_11_nama').nullable();
        t.text('ppn_11_memo').nullable();
        t.text('non_prospek').nullable();
        t.text('non_prospek_nama').nullable();
        t.text('non_prospek_memo').nullable();
        t.text('info_delay').nullable();
        t.text('info_delay_nama').nullable();
        t.text('info_delay_memo').nullable();
        t.text('job_minus').nullable();
        t.text('job_minus_nama').nullable();
        t.text('job_minus_memo').nullable();
        t.text('shipper_sendiri').nullable();
        t.text('shipper_sendiri_nama').nullable();
        t.text('shipper_sendiri_memo').nullable();
        t.text('wajib_invoice_sebelum_biaya').nullable();
        t.text('wajib_invoice_sebelum_biaya_nama').nullable();
        t.text('wajib_invoice_sebelum_biaya_memo').nullable();
        t.text('tanpa_nik_npwp').nullable();
        t.text('tanpa_nik_npwp_nama').nullable();
        t.text('tanpa_nik_npwp_memo').nullable();
        t.text('pusat').nullable();
        t.text('pusat_nama').nullable();
        t.text('pusat_memo').nullable();
        t.text('app_saldo_piutang').nullable();
        t.text('app_saldo_piutang_nama').nullable();
        t.text('app_saldo_piutang_memo').nullable();
        t.text('nama_paraf').nullable();
        t.text('nama_paraf_nama').nullable();
        t.text('nama_paraf_memo').nullable();
        t.text('not_order_trucking').nullable();
        t.text('not_order_trucking_nama').nullable();
        t.text('not_order_trucking_memo').nullable();
        t.text('passport').nullable();
        t.text('passport_nama').nullable();
        t.text('passport_memo').nullable();
        t.text('ppn_kunci').nullable();
        t.text('ppn_kunci_nama').nullable();
        t.text('ppn_kunci_memo').nullable();
        t.text('approval_shipper_job_minus').nullable();
        t.text('approval_shipper_job_minus_nama').nullable();
        t.text('approval_shipper_job_minus_memo').nullable();
        t.text('approval_top').nullable();
        t.text('approval_top_nama').nullable();
        t.text('approval_top_memo').nullable();
        t.text('blacklist_shipper').nullable();
        t.text('blacklist_shipper_nama').nullable();
        t.text('blacklist_shipper_memo').nullable();
        t.text('non_lapor_pajak').nullable();
        t.text('non_lapor_pajak_nama').nullable();
        t.text('non_lapor_pajak_memo').nullable();
        t.text('shipper_potongan').nullable();
        t.text('shipper_potongan_nama').nullable();
        t.text('shipper_potongan_memo').nullable();
        t.text('shipper_tidak_tagih_invoice_utama').nullable();
        t.text('shipper_tidak_tagih_invoice_utama_nama').nullable();
        t.text('shipper_tidak_tagih_invoice_utama_memo').nullable();
        t.text('not_tampil_web').nullable();
        t.text('not_tampil_web_nama').nullable();
        t.text('not_tampil_web_memo').nullable();
        t.text('not_free_admin').nullable();
        t.text('not_free_admin_nama').nullable();
        t.text('not_free_admin_memo').nullable();
        t.text('non_reimbursement').nullable();
        t.text('non_reimbursement_nama').nullable();
        t.text('non_reimbursement_memo').nullable();
        t.text('app_cetak_invoice_lain').nullable();
        t.text('app_cetak_invoice_lain_nama').nullable();
        t.text('app_cetak_invoice_lain_memo').nullable();
        t.text('lewat_hitung_ulang_ppn').nullable();
        t.text('lewat_hitung_ulang_ppn_nama').nullable();
        t.text('lewat_hitung_ulang_ppn_memo').nullable();
        t.text('online').nullable();
        t.text('online_nama').nullable();
        t.text('online_memo').nullable();
        t.text('keterangan_buruh').nullable();
        t.text('keterangan_buruh_nama').nullable();
        t.text('keterangan_buruh_memo').nullable();
        t.text('edit_keterangan_invoice_utama').nullable();
        t.text('edit_keterangan_invoice_utama_nama').nullable();
        t.text('edit_keterangan_invoice_utama_memo').nullable();
        t.text('tampil_keterangan_tambahan_sttb').nullable();
        t.text('tampil_keterangan_tambahan_sttb_nama').nullable();
        t.text('tampil_keterangan_tambahan_sttb_memo').nullable();
        t.text('update_ppn_shiper_khusus').nullable();
        t.text('update_ppn_shiper_khusus_nama').nullable();
        t.text('update_ppn_shiper_khusus_memo').nullable();
        t.text('shipper_rincian').nullable();
        t.text('shipper_rincian_nama').nullable();
        t.text('shipper_rincian_memo').nullable();
        t.text('national_id').nullable();
        t.text('national_id_nama').nullable();
        t.text('national_id_memo').nullable();
        t.text('refdesc_po').nullable();
        t.text('refdesc_po_nama').nullable();
        t.text('refdesc_po_memo').nullable();
      });

      await trx(tempStatusPendukung).insert(
        trx
          .select(
            'a.id',
            'a.statusdatapendukung',
            'a.transaksi_id',
            'a.statuspendukung',
            'a.keterangan',
            'a.modifiedby',
            'a.updated_at',
            'a.created_at',
          )
          .from('statuspendukung as a')
          .innerJoin('parameter as b', 'a.statusdatapendukung', 'b.id')
          .where('b.subgrp', tablename),
      );

      await trx(tempData).insert(
        trx
          .select(
            'a.id',
            trx.raw(
              `CONCAT(
                '{"statusdatapendukung":"',
                CASE
                  WHEN ISJSON(CAST(c.memo AS NVARCHAR(MAX))) = 1
                    THEN JSON_VALUE(CAST(c.memo AS NVARCHAR(MAX)), '$.MEMO')
                  ELSE ''
                END,
                '","transaksi_id":',
                TRIM(STR(ISNULL(b.transaksi_id, 0))),
                ',"statuspendukung":"',
                CASE
                  WHEN ISJSON(CAST(d.memo AS NVARCHAR(MAX))) = 1
                    THEN JSON_VALUE(CAST(d.memo AS NVARCHAR(MAX)), '$.MEMO')
                  ELSE ''
                END,
                '","keterangan":"',
                TRIM(ISNULL(b.keterangan, '')),
                '","updated_at":"',
                FORMAT(CAST(b.updated_at AS DATETIME), 'yyyy-MM-dd HH:mm:ss'),
                '","statuspendukung_id":"',
                TRIM(STR(ISNULL(d.id, 0))),
                '","statuspendukung_memo":',
               TRIM(CAST(d.memo AS NVARCHAR(MAX))),
                '}'
              ) AS keterangan`,
            ),
            trx.raw(
              `CASE
                WHEN ISJSON(CAST(c.memo AS NVARCHAR(MAX))) = 1
                  THEN JSON_VALUE(CAST(c.memo AS NVARCHAR(MAX)), '$.MEMO')
                ELSE ''
              END AS judul`,
            ),
          )
          .from(`${tablename} as a`)
          .innerJoin(`${tempStatusPendukung} as b`, 'a.id', 'b.transaksi_id')
          .innerJoin('parameter as c', 'b.statusdatapendukung', 'c.id')
          .innerJoin('parameter as d', 'b.statuspendukung', 'd.id'),
      );

      const columnsResult = await trx
        .select('judul')
        .from(tempData)
        .groupBy('judul');

      let columns = '';
      columnsResult.forEach((row, index) => {
        if (index === 0) {
          columns = `[${row.judul}]`;
        } else {
          columns += `, [${row.judul}]`;
        }
      });
      // console.log('columns',columns);

      if (!columns) {
        throw new Error('No columns generated for PIVOT');
      }

      const safeColumns = columns
        .replace(/\[TOP\]/gi, '[TOP_FIELD]')
        .replace(/\[OPEN\]/gi, '[OPEN_FIELD]');

      const pivotSubqueryRaw = `
        (
          SELECT id, ${safeColumns}
          FROM (
            SELECT
              id,
              CASE
                WHEN judul = 'TOP' THEN 'TOP_FIELD'
                WHEN judul = 'OPEN' THEN 'OPEN_FIELD'
                ELSE judul
              END AS judul,
              keterangan
            FROM ${tempData}
          ) AS SourceTable
          PIVOT (
            MAX(keterangan)
            FOR judul IN (${safeColumns})
          ) AS PivotTable
        ) AS A
      `;

      await trx(tempHasil).insert(
        trx
          .select([
            'A.id',
            trx.raw(
              "JSON_VALUE(A.[TIDAK ASURANSI], '$.statuspendukung_id') as statustidakasuransi",
            ),
            trx.raw(
              "JSON_VALUE(A.[TIDAK ASURANSI], '$.statuspendukung') as statustidakasuransi_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[TIDAK ASURANSI], '$.statuspendukung_memo') as statustidakasuransi_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[ASURANSI TAS], '$.statuspendukung_id') as asuransi_tas",
            ),
            trx.raw(
              "JSON_VALUE(A.[ASURANSI TAS], '$.statuspendukung') as asuransi_tas_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[ASURANSI TAS], '$.statuspendukung_memo') as asuransi_tas_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[TOP_FIELD], '$.statuspendukung_id') as top_field",
            ),
            trx.raw(
              "JSON_VALUE(A.[TOP_FIELD], '$.statuspendukung') as top_field_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[TOP_FIELD], '$.statuspendukung_memo') as top_field_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[OPEN_FIELD], '$.statuspendukung_id') as open_field",
            ),
            trx.raw(
              "JSON_VALUE(A.[OPEN_FIELD], '$.statuspendukung') as open_field_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[OPEN_FIELD], '$.statuspendukung_memo') as open_field_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[BONGKARAN], '$.statuspendukung_id') as bongkaran",
            ),
            trx.raw(
              "JSON_VALUE(A.[BONGKARAN], '$.statuspendukung') as bongkaran_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[BONGKARAN], '$.statuspendukung_memo') as bongkaran_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[DELIVERY REPORT], '$.statuspendukung_id') as delivery_report",
            ),
            trx.raw(
              "JSON_VALUE(A.[DELIVERY REPORT], '$.statuspendukung') as delivery_report_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[DELIVERY REPORT], '$.statuspendukung_memo') as delivery_report_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[FINAL ASURANSI BULAN], '$.statuspendukung_id') as final_asuransi_bulan",
            ),
            trx.raw(
              "JSON_VALUE(A.[FINAL ASURANSI BULAN], '$.statuspendukung') as final_asuransi_bulan_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[FINAL ASURANSI BULAN], '$.statuspendukung_memo') as final_asuransi_bulan_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[JOB BANYAK INVOICE], '$.statuspendukung_id') as job_banyak_invoice",
            ),
            trx.raw(
              "JSON_VALUE(A.[JOB BANYAK INVOICE], '$.statuspendukung') as job_banyak_invoice_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[JOB BANYAK INVOICE], '$.statuspendukung_memo') as job_banyak_invoice_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[JOB PAJAK], '$.statuspendukung_id') as job_pajak",
            ),
            trx.raw(
              "JSON_VALUE(A.[JOB PAJAK], '$.statuspendukung') as job_pajak_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[JOB PAJAK], '$.statuspendukung_memo') as job_pajak_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[CETAK KETERANGAN SHIPPER], '$.statuspendukung_id') as cetak_keterangan_shipper",
            ),
            trx.raw(
              "JSON_VALUE(A.[CETAK KETERANGAN SHIPPER], '$.statuspendukung') as cetak_keterangan_shipper_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[CETAK KETERANGAN SHIPPER], '$.statuspendukung_memo') as cetak_keterangan_shipper_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[FUMIGASI], '$.statuspendukung_id') as fumigasi",
            ),
            trx.raw(
              "JSON_VALUE(A.[FUMIGASI], '$.statuspendukung') as fumigasi_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[FUMIGASI], '$.statuspendukung_memo') as fumigasi_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[ADJUST TAGIH WARKAT], '$.statuspendukung_id') as adjust_tagih_warkat",
            ),
            trx.raw(
              "JSON_VALUE(A.[ADJUST TAGIH WARKAT], '$.statuspendukung') as adjust_tagih_warkat_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[ADJUST TAGIH WARKAT], '$.statuspendukung_memo') as adjust_tagih_warkat_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[JOB NON PPN], '$.statuspendukung_id') as job_non_ppn",
            ),
            trx.raw(
              "JSON_VALUE(A.[JOB NON PPN], '$.statuspendukung') as job_non_ppn_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[JOB NON PPN], '$.statuspendukung_memo') as job_non_ppn_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[APPROVAL PAJAKP PISAH ONGKOS], '$.statuspendukung_id') as approval_pajakp_pisah_ongkos",
            ),
            trx.raw(
              "JSON_VALUE(A.[APPROVAL PAJAKP PISAH ONGKOS], '$.statuspendukung') as approval_pajakp_pisah_ongkos_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[APPROVAL PAJAKP PISAH ONGKOS], '$.statuspendukung_memo') as approval_pajakp_pisah_ongkos_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[DECIMAL INVOICE], '$.statuspendukung_id') as decimal_invoice",
            ),
            trx.raw(
              "JSON_VALUE(A.[DECIMAL INVOICE], '$.statuspendukung') as decimal_invoice_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[DECIMAL INVOICE], '$.statuspendukung_memo') as decimal_invoice_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[REIMBURSEMENT], '$.statuspendukung_id') as reimbursement",
            ),
            trx.raw(
              "JSON_VALUE(A.[REIMBURSEMENT], '$.statuspendukung') as reimbursement_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[REIMBURSEMENT], '$.statuspendukung_memo') as reimbursement_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[NOT INVOICE TAMBAHAN], '$.statuspendukung_id') as not_invoice_tambahan",
            ),
            trx.raw(
              "JSON_VALUE(A.[NOT INVOICE TAMBAHAN], '$.statuspendukung') as not_invoice_tambahan_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[NOT INVOICE TAMBAHAN], '$.statuspendukung_memo') as not_invoice_tambahan_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[INVOICE JASA PENGURUSAN TRANSPORTASI], '$.statuspendukung_id') as invoice_jasa_pengurusan_transportasi",
            ),
            trx.raw(
              "JSON_VALUE(A.[INVOICE JASA PENGURUSAN TRANSPORTASI], '$.statuspendukung') as invoice_jasa_pengurusan_transportasi_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[INVOICE JASA PENGURUSAN TRANSPORTASI], '$.statuspendukung_memo') as invoice_jasa_pengurusan_transportasi_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[NOT UCASE SHIPPER], '$.statuspendukung_id') as not_ucase_shipper",
            ),
            trx.raw(
              "JSON_VALUE(A.[NOT UCASE SHIPPER], '$.statuspendukung') as not_ucase_shipper_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[NOT UCASE SHIPPER], '$.statuspendukung_memo') as not_ucase_shipper_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER STTB], '$.statuspendukung_id') as shipper_sttb",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER STTB], '$.statuspendukung') as shipper_sttb_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[SHIPPER STTB], '$.statuspendukung_memo') as shipper_sttb_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER CABANG], '$.statuspendukung_id') as shipper_cabang",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER CABANG], '$.statuspendukung') as shipper_cabang_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[SHIPPER CABANG], '$.statuspendukung_memo') as shipper_cabang_memo",
            ),
            trx.raw("JSON_VALUE(A.[SPK], '$.statuspendukung_id') as spk"),
            trx.raw("JSON_VALUE(A.[SPK], '$.statuspendukung') as spk_nama"),
            trx.raw(
              "JSON_QUERY(A.[SPK], '$.statuspendukung_memo') as spk_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[PPN WARKAT EKSPORT], '$.statuspendukung_id') as ppn_warkat_eksport",
            ),
            trx.raw(
              "JSON_VALUE(A.[PPN WARKAT EKSPORT], '$.statuspendukung') as ppn_warkat_eksport_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[PPN WARKAT EKSPORT], '$.statuspendukung_memo') as ppn_warkat_eksport_memo",
            ),
            trx.raw("JSON_VALUE(A.[PPN 11], '$.statuspendukung_id') as ppn_11"),
            trx.raw(
              "JSON_VALUE(A.[PPN 11], '$.statuspendukung') as ppn_11_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[PPN 11], '$.statuspendukung_memo') as ppn_11_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[NON PROSPEK], '$.statuspendukung_id') as non_prospek",
            ),
            trx.raw(
              "JSON_VALUE(A.[NON PROSPEK], '$.statuspendukung') as non_prospek_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[NON PROSPEK], '$.statuspendukung_memo') as non_prospek_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[INFO DELAY], '$.statuspendukung_id') as info_delay",
            ),
            trx.raw(
              "JSON_VALUE(A.[INFO DELAY], '$.statuspendukung') as info_delay_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[INFO DELAY], '$.statuspendukung_memo') as info_delay_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[JOB MINUS], '$.statuspendukung_id') as job_minus",
            ),
            trx.raw(
              "JSON_VALUE(A.[JOB MINUS], '$.statuspendukung') as job_minus_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[JOB MINUS], '$.statuspendukung_memo') as job_minus_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER SENDIRI], '$.statuspendukung_id') as shipper_sendiri",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER SENDIRI], '$.statuspendukung') as shipper_sendiri_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[SHIPPER SENDIRI], '$.statuspendukung_memo') as shipper_sendiri_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[WAJIB INVOICE SEBELUM BIAYA], '$.statuspendukung_id') as wajib_invoice_sebelum_biaya",
            ),
            trx.raw(
              "JSON_VALUE(A.[WAJIB INVOICE SEBELUM BIAYA], '$.statuspendukung') as wajib_invoice_sebelum_biaya_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[WAJIB INVOICE SEBELUM BIAYA], '$.statuspendukung_memo') as wajib_invoice_sebelum_biaya_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[TANPA NIK NPWP], '$.statuspendukung_id') as tanpa_nik_npwp",
            ),
            trx.raw(
              "JSON_VALUE(A.[TANPA NIK NPWP], '$.statuspendukung') as tanpa_nik_npwp_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[TANPA NIK NPWP], '$.statuspendukung_memo') as tanpa_nik_npwp_memo",
            ),
            trx.raw("JSON_VALUE(A.[PUSAT], '$.statuspendukung_id') as pusat"),
            trx.raw("JSON_VALUE(A.[PUSAT], '$.statuspendukung') as pusat_nama"),
            trx.raw(
              "JSON_QUERY(A.[PUSAT], '$.statuspendukung_memo') as pusat_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[APP SALDO PIUTANG], '$.statuspendukung_id') as app_saldo_piutang",
            ),
            trx.raw(
              "JSON_VALUE(A.[APP SALDO PIUTANG], '$.statuspendukung') as app_saldo_piutang_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[APP SALDO PIUTANG], '$.statuspendukung_memo') as app_saldo_piutang_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[NAMA PARAF], '$.statuspendukung_id') as nama_paraf",
            ),
            trx.raw(
              "JSON_VALUE(A.[NAMA PARAF], '$.statuspendukung') as nama_paraf_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[NAMA PARAF], '$.statuspendukung_memo') as nama_paraf_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[NOT ORDER TRUCKING], '$.statuspendukung_id') as not_order_trucking",
            ),
            trx.raw(
              "JSON_VALUE(A.[NOT ORDER TRUCKING], '$.statuspendukung') as not_order_trucking_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[NOT ORDER TRUCKING], '$.statuspendukung_memo') as not_order_trucking_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[PASSPORT], '$.statuspendukung_id') as passport",
            ),
            trx.raw(
              "JSON_VALUE(A.[PASSPORT], '$.statuspendukung') as passport_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[PASSPORT], '$.statuspendukung_memo') as passport_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[PPN KUNCI], '$.statuspendukung_id') as ppn_kunci",
            ),
            trx.raw(
              "JSON_VALUE(A.[PPN KUNCI], '$.statuspendukung') as ppn_kunci_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[PPN KUNCI], '$.statuspendukung_memo') as ppn_kunci_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[APPROVAL SHIPPER JOB MINUS], '$.statuspendukung_id') as approval_shipper_job_minus",
            ),
            trx.raw(
              "JSON_VALUE(A.[APPROVAL SHIPPER JOB MINUS], '$.statuspendukung') as approval_shipper_job_minus_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[APPROVAL SHIPPER JOB MINUS], '$.statuspendukung_memo') as approval_shipper_job_minus_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[APPROVAL TOP], '$.statuspendukung_id') as approval_top",
            ),
            trx.raw(
              "JSON_VALUE(A.[APPROVAL TOP], '$.statuspendukung') as approval_top_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[APPROVAL TOP], '$.statuspendukung_memo') as approval_top_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[BLACKLIST SHIPPER], '$.statuspendukung_id') as blacklist_shipper",
            ),
            trx.raw(
              "JSON_VALUE(A.[BLACKLIST SHIPPER], '$.statuspendukung') as blacklist_shipper_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[BLACKLIST SHIPPER], '$.statuspendukung_memo') as blacklist_shipper_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[NON LAPOR PAJAK], '$.statuspendukung_id') as non_lapor_pajak",
            ),
            trx.raw(
              "JSON_VALUE(A.[NON LAPOR PAJAK], '$.statuspendukung') as non_lapor_pajak_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[NON LAPOR PAJAK], '$.statuspendukung_memo') as non_lapor_pajak_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER POTONGAN], '$.statuspendukung_id') as shipper_potongan",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER POTONGAN], '$.statuspendukung') as shipper_potongan_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[SHIPPER POTONGAN], '$.statuspendukung_memo') as shipper_potongan_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER TIDAK TAGIH INVOICE UTAMA], '$.statuspendukung_id') as shipper_tidak_tagih_invoice_utama",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER TIDAK TAGIH INVOICE UTAMA], '$.statuspendukung') as shipper_tidak_tagih_invoice_utama_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[SHIPPER TIDAK TAGIH INVOICE UTAMA], '$.statuspendukung_memo') as shipper_tidak_tagih_invoice_utama_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[NOT TAMPIL WEB], '$.statuspendukung_id') as not_tampil_web",
            ),
            trx.raw(
              "JSON_VALUE(A.[NOT TAMPIL WEB], '$.statuspendukung') as not_tampil_web_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[NOT TAMPIL WEB], '$.statuspendukung_memo') as not_tampil_web_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[NOT FREE ADMIN], '$.statuspendukung_id') as not_free_admin",
            ),
            trx.raw(
              "JSON_VALUE(A.[NOT FREE ADMIN], '$.statuspendukung') as not_free_admin_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[NOT FREE ADMIN], '$.statuspendukung_memo') as not_free_admin_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[NON REIMBURSEMENT], '$.statuspendukung_id') as non_reimbursement",
            ),
            trx.raw(
              "JSON_VALUE(A.[NON REIMBURSEMENT], '$.statuspendukung') as non_reimbursement_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[NON REIMBURSEMENT], '$.statuspendukung_memo') as non_reimbursement_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[APP CETAK INVOICE LAIN], '$.statuspendukung_id') as app_cetak_invoice_lain",
            ),
            trx.raw(
              "JSON_VALUE(A.[APP CETAK INVOICE LAIN], '$.statuspendukung') as app_cetak_invoice_lain_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[APP CETAK INVOICE LAIN], '$.statuspendukung_memo') as app_cetak_invoice_lain_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[LEWAT HITUNG ULANG PPN], '$.statuspendukung_id') as lewat_hitung_ulang_ppn",
            ),
            trx.raw(
              "JSON_VALUE(A.[LEWAT HITUNG ULANG PPN], '$.statuspendukung') as lewat_hitung_ulang_ppn_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[LEWAT HITUNG ULANG PPN], '$.statuspendukung_memo') as lewat_hitung_ulang_ppn_memo",
            ),
            trx.raw("JSON_VALUE(A.[ONLINE], '$.statuspendukung_id') as online"),
            trx.raw(
              "JSON_VALUE(A.[ONLINE], '$.statuspendukung') as online_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[ONLINE], '$.statuspendukung_memo') as online_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[KETERANGAN BURUH], '$.statuspendukung_id') as keterangan_buruh",
            ),
            trx.raw(
              "JSON_VALUE(A.[KETERANGAN BURUH], '$.statuspendukung') as keterangan_buruh_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[KETERANGAN BURUH], '$.statuspendukung_memo') as keterangan_buruh_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[EDIT KETERANGAN INVOICE UTAMA], '$.statuspendukung_id') as edit_keterangan_invoice_utama",
            ),
            trx.raw(
              "JSON_VALUE(A.[EDIT KETERANGAN INVOICE UTAMA], '$.statuspendukung') as edit_keterangan_invoice_utama_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[EDIT KETERANGAN INVOICE UTAMA], '$.statuspendukung_memo') as edit_keterangan_invoice_utama_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[TAMPIL KETERANGAN TAMBAHAN STTB], '$.statuspendukung_id') as tampil_keterangan_tambahan_sttb",
            ),
            trx.raw(
              "JSON_VALUE(A.[TAMPIL KETERANGAN TAMBAHAN STTB], '$.statuspendukung') as tampil_keterangan_tambahan_sttb_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[TAMPIL KETERANGAN TAMBAHAN STTB], '$.statuspendukung_memo') as tampil_keterangan_tambahan_sttb_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[UPDATE PPN SHIPER KHUSUS], '$.statuspendukung_id') as update_ppn_shiper_khusus",
            ),
            trx.raw(
              "JSON_VALUE(A.[UPDATE PPN SHIPER KHUSUS], '$.statuspendukung') as update_ppn_shiper_khusus_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[UPDATE PPN SHIPER KHUSUS], '$.statuspendukung_memo') as update_ppn_shiper_khusus_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER RINCIAN], '$.statuspendukung_id') as shipper_rincian",
            ),
            trx.raw(
              "JSON_VALUE(A.[SHIPPER RINCIAN], '$.statuspendukung') as shipper_rincian_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[SHIPPER RINCIAN], '$.statuspendukung_memo') as shipper_rincian_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[NATIONAL ID], '$.statuspendukung_id') as national_id",
            ),
            trx.raw(
              "JSON_VALUE(A.[NATIONAL ID], '$.statuspendukung') as national_id_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[NATIONAL ID], '$.statuspendukung_memo') as national_id_memo",
            ),
            trx.raw(
              "JSON_VALUE(A.[REFDESC PO], '$.statuspendukung_id') as refdesc_po",
            ),
            trx.raw(
              "JSON_VALUE(A.[REFDESC PO], '$.statuspendukung') as refdesc_po_nama",
            ),
            trx.raw(
              "JSON_QUERY(A.[REFDESC PO], '$.statuspendukung_memo') as refdesc_po_memo",
            ),
          ])
          .from(trx.raw(pivotSubqueryRaw)),
      );

      return tempHasil;
    } catch (error) {
      console.error('Error fetching data shipper pvt hardcore:', error);
      throw new Error('Failed to fetch shipper pvt');
    }
  }

  async update(id: number, data: any, trx: any) {
    data.tglemailshipperjobminus = formatDateToSQL(
      String(data?.tglemailshipperjobminus),
    );
    data.tgllahir = formatDateToSQL(String(data?.tgllahir));

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
        id: skipId,
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

      // Update relasi
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

      await this.relasiService.update(existingData.relasi_id, relasi, trx);

      // ========== LOGIKA BARU: SAMA SEPERTI CREATE ==========

      // Hitung posisi item yang diupdate
      let posisi = 0;
      let totalItems = 0;

      const LastId = await trx(this.tableName)
        .select('id')
        .orderBy('id', 'desc')
        .first();
      const resultposition = await trx('vtemp')
        .count('* as posisi')
        .where(
          sortBy,
          sortDirection === 'desc' ? '>=' : '<=',
          insertData[sortBy],
        )
        .where('id', '<=', LastId?.id)
        .first();

      const totalRecords = await trx(this.tableName)
        .count('id as total')
        .first();
      console.log('existingData[sortBy]', existingData[sortBy]);
      console.log('resultposition', resultposition);
      console.log('totalRecords', totalRecords);
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

      // Log trail
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

      // Cache data per page ke Redis
      await this.redisService.set(
        `${this.tableName}-page-${pageNumber}`,
        JSON.stringify(allFetchedData),
      );

      return {
        updatedItem: {
          id,
          ...data,
        },
        itemIndex: itemIndex.zeroBasedIndex,
        pageNumber,
        fetchedPages,
        pagedData,
      };
    } catch (error) {
      console.error('Error updating shipper:', error);
      throw new Error(`Failed to update shipper: ${error.message}`);
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
      await this.statuspendukungService.remove(id, modifiedby, trx);
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

  async findShipperColumns(trx: any) {
    try {
      const result = await trx(this.tableName)
        .select(
          trx.raw(`
            JSON_VALUE(CAST(memo AS NVARCHAR(MAX)), '$.MEMO') AS memo_value
          `),
        )
        .where('grp', 'DATA PENDUKUNG')
        .andWhere('subgrp', 'SHIPPER')
        .whereNotNull('memo')
        .from('parameter');

      const columns = result
        .map((row) => row.memo_value?.trim())
        .filter((val) => val && val.length > 0);

      return columns;
    } catch (error) {
      console.error('Error fetching shipper columns:', error);
      throw new InternalServerErrorException('Failed to fetch shipper columns');
    }
  }
}
