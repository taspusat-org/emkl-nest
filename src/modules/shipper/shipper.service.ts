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
import { StatuspendukungService } from '../statuspendukung/statuspendukung.service';
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

      await this.statuspendukungService.create(
        this.tableName,
        newItem.id,
        insertData.modifiedby,
        trx,
      );

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
      let { page, limit } = pagination ?? {};
      page = page ?? 1;
      limit = 0;

      const pvtFields = [
        'statustidakasuransi',
        'asuransi_tas',
        'top_field',
        'open_field',
        'bongkaran',
        'delivery_report',
        'final_asuransi_bulan',
        'job_banyak_invoice',
        'job_pajak',
        'cetak_keterangan_shipper',
        'fumigasi',
        'adjust_tagih_warkat',
        'job_non_ppn',
        'approval_pajakp_pisah_ongkos',
        'decimal_invoice',
        'reimbursement',
        'not_invoice_tambahan',
        'invoice_jasa_pengurusan_transportasi',
        'not_ucase_shipper',
        'shipper_sttb',
        'shipper_cabang',
        'spk',
        'ppn_warkat_eksport',
        'ppn_11',
        'non_prospek',
        'info_delay',
        'job_minus',
        'shipper_sendiri',
        'wajib_invoice_sebelum_biaya',
        'tanpa_nik_npwp',
        'pusat',
        'app_saldo_piutang',
        'nama_paraf',
        'not_order_trucking',
        'passport',
        'ppn_kunci',
        'approval_shipper_job_minus',
        'approval_top',
        'blacklist_shipper',
        'non_lapor_pajak',
        'shipper_potongan',
        'shipper_tidak_tagih_invoice_utama',
        'not_tampil_web',
        'not_free_admin',
        'non_reimbursement',
        'app_cetak_invoice_lain',
        'lewat_hitung_ulang_ppn',
        'online',
        'keterangan_buruh',
        'edit_keterangan_invoice_utama',
        'tampil_keterangan_tambahan_sttb',
        'update_ppn_shiper_khusus',
        'shipper_rincian',
        'national_id',
        'refdesc_po',
      ];

      const jsonColumns = pvtFields.flatMap((judul: any) => {
        return [`${judul}`, `${judul}_nama`, `${judul}_memo`];
      });

      const dataTempStatusPendukung =
        await this.utilsService.tempPivotStatusPendukung(
          trx,
          this.tableName,
          jsonColumns,
        );

      // console.log(await trx(dataTempStatusPendukung).select('*'), 'TES');
      const query = trx
        .from(trx.raw(`${this.tableName} as s WITH (READUNCOMMITTED)`))
        .select([
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
          trx.raw(
            "FORMAT(s.tglemailshipperjobminus, 'dd-MM-yyyy') as tglemailshipperjobminus",
          ),
          trx.raw("FORMAT(s.tgllahir, 'dd-MM-yyyy') as tgllahir"),
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
          trx.raw("FORMAT(s.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
          trx.raw("FORMAT(s.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
          'p.memo',
          'p.text',
          'q.keterangancoa as coa_text',
          'q2.keterangancoa as coapiutang_text',
          'q3.keterangancoa as coahutang_text',
          'q4.keterangancoa as coagiro_text',
          's1.nama as shipperasal_text',
          's2.nama as parentshipper_text',
          'm.nama as marketing_text',

          'pvt.statustidakasuransi as statustidakasuransi',
          'pvt.statustidakasuransi_nama as statustidakasuransi_nama',
          'pvt.statustidakasuransi_memo as statustidakasuransi_memo',

          'pvt.asuransi_tas as asuransi_tas',
          'pvt.asuransi_tas_nama as asuransi_tas_nama',
          'pvt.asuransi_tas_memo as asuransi_tas_memo',

          'pvt.top_field as top_field',
          'pvt.top_field_nama as top_field_nama',
          'pvt.top_field_memo as top_field_memo',

          'pvt.open_field as open_field',
          'pvt.open_field_nama as open_field_nama',
          'pvt.open_field_memo as open_field_memo',

          'pvt.bongkaran as bongkaran',
          'pvt.bongkaran_nama as bongkaran_nama',
          'pvt.bongkaran_memo as bongkaran_memo',

          'pvt.delivery_report as delivery_report',
          'pvt.delivery_report_nama as delivery_report_nama',
          'pvt.delivery_report_memo as delivery_report_memo',

          'pvt.final_asuransi_bulan as final_asuransi_bulan',
          'pvt.final_asuransi_bulan_nama as final_asuransi_bulan_nama',
          'pvt.final_asuransi_bulan_memo as final_asuransi_bulan_memo',

          'pvt.job_banyak_invoice as job_banyak_invoice',
          'pvt.job_banyak_invoice_nama as job_banyak_invoice_nama',
          'pvt.job_banyak_invoice_memo as job_banyak_invoice_memo',

          'pvt.job_pajak as job_pajak',
          'pvt.job_pajak_nama as job_pajak_nama',
          'pvt.job_pajak_memo as job_pajak_memo',

          'pvt.cetak_keterangan_shipper as cetak_keterangan_shipper',
          'pvt.cetak_keterangan_shipper_nama as cetak_keterangan_shipper_nama',
          'pvt.cetak_keterangan_shipper_memo as cetak_keterangan_shipper_memo',

          'pvt.fumigasi as fumigasi',
          'pvt.fumigasi_nama as fumigasi_nama',
          'pvt.fumigasi_memo as fumigasi_memo',

          'pvt.adjust_tagih_warkat as adjust_tagih_warkat',
          'pvt.adjust_tagih_warkat_nama as adjust_tagih_warkat_nama',
          'pvt.adjust_tagih_warkat_memo as adjust_tagih_warkat_memo',

          'pvt.job_non_ppn as job_non_ppn',
          'pvt.job_non_ppn_nama as job_non_ppn_nama',
          'pvt.job_non_ppn_memo as job_non_ppn_memo',

          'pvt.approval_pajakp_pisah_ongkos as approval_pajakp_pisah_ongkos',
          'pvt.approval_pajakp_pisah_ongkos_nama as approval_pajakp_pisah_ongkos_nama',
          'pvt.approval_pajakp_pisah_ongkos_memo as approval_pajakp_pisah_ongkos_memo',

          'pvt.decimal_invoice as decimal_invoice',
          'pvt.decimal_invoice_nama as decimal_invoice_nama',
          'pvt.decimal_invoice_memo as decimal_invoice_memo',

          'pvt.reimbursement as reimbursement',
          'pvt.reimbursement_nama as reimbursement_nama',
          'pvt.reimbursement_memo as reimbursement_memo',

          'pvt.not_invoice_tambahan as not_invoice_tambahan',
          'pvt.not_invoice_tambahan_nama as not_invoice_tambahan_nama',
          'pvt.not_invoice_tambahan_memo as not_invoice_tambahan_memo',

          'pvt.invoice_jasa_pengurusan_transportasi as invoice_jasa_pengurusan_transportasi',
          'pvt.invoice_jasa_pengurusan_transportasi_nama as invoice_jasa_pengurusan_transportasi_nama',
          'pvt.invoice_jasa_pengurusan_transportasi_memo as invoice_jasa_pengurusan_transportasi_memo',

          'pvt.not_ucase_shipper as not_ucase_shipper',
          'pvt.not_ucase_shipper_nama as not_ucase_shipper_nama',
          'pvt.not_ucase_shipper_memo as not_ucase_shipper_memo',

          'pvt.shipper_sttb as shipper_sttb',
          'pvt.shipper_sttb_nama as shipper_sttb_nama',
          'pvt.shipper_sttb_memo as shipper_sttb_memo',

          'pvt.shipper_cabang as shipper_cabang',
          'pvt.shipper_cabang_nama as shipper_cabang_nama',
          'pvt.shipper_cabang_memo as shipper_cabang_memo',

          'pvt.spk as spk',
          'pvt.spk_nama as spk_nama',
          'pvt.spk_memo as spk_memo',

          'pvt.ppn_warkat_eksport as ppn_warkat_eksport',
          'pvt.ppn_warkat_eksport_nama as ppn_warkat_eksport_nama',
          'pvt.ppn_warkat_eksport_memo as ppn_warkat_eksport_memo',

          'pvt.ppn_11 as ppn_11',
          'pvt.ppn_11_nama as ppn_11_nama',
          'pvt.ppn_11_memo as ppn_11_memo',

          'pvt.non_prospek as non_prospek',
          'pvt.non_prospek_nama as non_prospek_nama',
          'pvt.non_prospek_memo as non_prospek_memo',

          'pvt.info_delay as info_delay',
          'pvt.info_delay_nama as info_delay_nama',
          'pvt.info_delay_memo as info_delay_memo',

          'pvt.job_minus as job_minus',
          'pvt.job_minus_nama as job_minus_nama',
          'pvt.job_minus_memo as job_minus_memo',

          'pvt.shipper_sendiri as shipper_sendiri',
          'pvt.shipper_sendiri_nama as shipper_sendiri_nama',
          'pvt.shipper_sendiri_memo as shipper_sendiri_memo',

          'pvt.wajib_invoice_sebelum_biaya as wajib_invoice_sebelum_biaya',
          'pvt.wajib_invoice_sebelum_biaya_nama as wajib_invoice_sebelum_biaya_nama',
          'pvt.wajib_invoice_sebelum_biaya_memo as wajib_invoice_sebelum_biaya_memo',

          'pvt.tanpa_nik_npwp as tanpa_nik_npwp',
          'pvt.tanpa_nik_npwp_nama as tanpa_nik_npwp_nama',
          'pvt.tanpa_nik_npwp_memo as tanpa_nik_npwp_memo',

          'pvt.pusat as pusat',
          'pvt.pusat_nama as pusat_nama',
          'pvt.pusat_memo as pusat_memo',

          'pvt.app_saldo_piutang as app_saldo_piutang',
          'pvt.app_saldo_piutang_nama as app_saldo_piutang_nama',
          'pvt.app_saldo_piutang_memo as app_saldo_piutang_memo',

          'pvt.nama_paraf as nama_paraf',
          'pvt.nama_paraf_nama as nama_paraf_nama',
          'pvt.nama_paraf_memo as nama_paraf_memo',

          'pvt.not_order_trucking as not_order_trucking',
          'pvt.not_order_trucking_nama as not_order_trucking_nama',
          'pvt.not_order_trucking_memo as not_order_trucking_memo',

          'pvt.passport as passport',
          'pvt.passport_nama as passport_nama',
          'pvt.passport_memo as passport_memo',

          'pvt.ppn_kunci as ppn_kunci',
          'pvt.ppn_kunci_nama as ppn_kunci_nama',
          'pvt.ppn_kunci_memo as ppn_kunci_memo',

          'pvt.approval_shipper_job_minus as approval_shipper_job_minus',
          'pvt.approval_shipper_job_minus_nama as approval_shipper_job_minus_nama',
          'pvt.approval_shipper_job_minus_memo as approval_shipper_job_minus_memo',

          'pvt.approval_top as approval_top',
          'pvt.approval_top_nama as approval_top_nama',
          'pvt.approval_top_memo as approval_top_memo',

          'pvt.blacklist_shipper as blacklist_shipper',
          'pvt.blacklist_shipper_nama as blacklist_shipper_nama',
          'pvt.blacklist_shipper_memo as blacklist_shipper_memo',

          'pvt.non_lapor_pajak as non_lapor_pajak',
          'pvt.non_lapor_pajak_nama as non_lapor_pajak_nama',
          'pvt.non_lapor_pajak_memo as non_lapor_pajak_memo',

          'pvt.shipper_potongan as shipper_potongan',
          'pvt.shipper_potongan_nama as shipper_potongan_nama',
          'pvt.shipper_potongan_memo as shipper_potongan_memo',

          'pvt.shipper_tidak_tagih_invoice_utama as shipper_tidak_tagih_invoice_utama',
          'pvt.shipper_tidak_tagih_invoice_utama_nama as shipper_tidak_tagih_invoice_utama_nama',
          'pvt.shipper_tidak_tagih_invoice_utama_memo as shipper_tidak_tagih_invoice_utama_memo',

          'pvt.not_tampil_web as not_tampil_web',
          'pvt.not_tampil_web_nama as not_tampil_web_nama',
          'pvt.not_tampil_web_memo as not_tampil_web_memo',

          'pvt.not_free_admin as not_free_admin',
          'pvt.not_free_admin_nama as not_free_admin_nama',
          'pvt.not_free_admin_memo as not_free_admin_memo',

          'pvt.non_reimbursement as non_reimbursement',
          'pvt.non_reimbursement_nama as non_reimbursement_nama',
          'pvt.non_reimbursement_memo as non_reimbursement_memo',

          'pvt.app_cetak_invoice_lain as app_cetak_invoice_lain',
          'pvt.app_cetak_invoice_lain_nama as app_cetak_invoice_lain_nama',
          'pvt.app_cetak_invoice_lain_memo as app_cetak_invoice_lain_memo',

          'pvt.lewat_hitung_ulang_ppn as lewat_hitung_ulang_ppn',
          'pvt.lewat_hitung_ulang_ppn_nama as lewat_hitung_ulang_ppn_nama',
          'pvt.lewat_hitung_ulang_ppn_memo as lewat_hitung_ulang_ppn_memo',

          'pvt.online as online',
          'pvt.online_nama as online_nama',
          'pvt.online_memo as online_memo',

          'pvt.keterangan_buruh as keterangan_buruh',
          'pvt.keterangan_buruh_nama as keterangan_buruh_nama',
          'pvt.keterangan_buruh_memo as keterangan_buruh_memo',

          'pvt.edit_keterangan_invoice_utama as edit_keterangan_invoice_utama',
          'pvt.edit_keterangan_invoice_utama_nama as edit_keterangan_invoice_utama_nama',
          'pvt.edit_keterangan_invoice_utama_memo as edit_keterangan_invoice_utama_memo',

          'pvt.tampil_keterangan_tambahan_sttb as tampil_keterangan_tambahan_sttb',
          'pvt.tampil_keterangan_tambahan_sttb_nama as tampil_keterangan_tambahan_sttb_nama',
          'pvt.tampil_keterangan_tambahan_sttb_memo as tampil_keterangan_tambahan_sttb_memo',

          'pvt.update_ppn_shiper_khusus as update_ppn_shiper_khusus',
          'pvt.update_ppn_shiper_khusus_nama as update_ppn_shiper_khusus_nama',
          'pvt.update_ppn_shiper_khusus_memo as update_ppn_shiper_khusus_memo',

          'pvt.shipper_rincian as shipper_rincian',
          'pvt.shipper_rincian_nama as shipper_rincian_nama',
          'pvt.shipper_rincian_memo as shipper_rincian_memo',

          'pvt.national_id as national_id',
          'pvt.national_id_nama as national_id_nama',
          'pvt.national_id_memo as national_id_memo',

          'pvt.refdesc_po as refdesc_po',
          'pvt.refdesc_po_nama as refdesc_po_nama',
          'pvt.refdesc_po_memo as refdesc_po_memo',
        ])
        .leftJoin(
          trx.raw('parameter as p WITH (READUNCOMMITTED)'),
          's.statusaktif',
          'p.id',
        )
        .leftJoin(
          trx.raw('akunpusat as q WITH (READUNCOMMITTED)'),
          's.coa',
          'q.coa',
        )
        .leftJoin(
          trx.raw('akunpusat as q2 WITH (READUNCOMMITTED)'),
          's.coapiutang',
          'q2.coa',
        )
        .leftJoin(
          trx.raw('akunpusat as q3 WITH (READUNCOMMITTED)'),
          's.coahutang',
          'q3.coa',
        )
        .leftJoin(
          trx.raw('akunpusat as q4 WITH (READUNCOMMITTED)'),
          's.coagiro',
          'q4.coa',
        )
        .leftJoin(
          trx.raw('shipper as s1 WITH (READUNCOMMITTED)'),
          's.idshipperasal',
          's1.id',
        )
        .leftJoin(
          trx.raw('shipper as s2 WITH (READUNCOMMITTED)'),
          's.parentshipper_id',
          's2.id',
        )
        .leftJoin(
          trx.raw('marketing as m WITH (READUNCOMMITTED)'),
          's.marketing_id',
          'm.id',
        )
        .leftJoin(`${dataTempStatusPendukung} as pvt`, 's.id', 'pvt.id');

      const pvtCols = [
        'statustidakasuransi',
        'asuransi_tas',
        'top_field',
        'open_field',
        'bongkaran',
        'delivery_report',
        'final_asuransi_bulan',
        'job_banyak_invoice',
        'job_pajak',
        'cetak_keterangan_shipper',
        'fumigasi',
        'adjust_tagih_warkat',
        'job_non_ppn',
        'approval_pajakp_pisah_ongkos',
        'decimal_invoice',
        'reimbursement',
        'not_invoice_tambahan',
        'invoice_jasa_pengurusan_transportasi',
        'not_ucase_shipper',
        'shipper_sttb',
        'shipper_cabang',
        'spk',
        'ppn_warkat_eksport',
        'ppn_11',
        'non_prospek',
        'info_delay',
        'job_minus',
        'shipper_sendiri',
        'wajib_invoice_sebelum_biaya',
        'tanpa_nik_npwp',
        'pusat',
        'app_saldo_piutang',
        'nama_paraf',
        'not_order_trucking',
        'passport',
        'ppn_kunci',
        'approval_shipper_job_minus',
        'approval_top',
        'blacklist_shipper',
        'non_lapor_pajak',
        'shipper_potongan',
        'shipper_tidak_tagih_invoice_utama',
        'not_tampil_web',
        'not_free_admin',
        'non_reimbursement',
        'app_cetak_invoice_lain',
        'lewat_hitung_ulang_ppn',
        'online',
        'keterangan_buruh',
        'edit_keterangan_invoice_utama',
        'tampil_keterangan_tambahan_sttb',
        'update_ppn_shiper_khusus',
        'shipper_rincian',
        'national_id',
        'refdesc_po',
      ];
      const excludeSearchKeys = [
        'statusrelasi',
        'relasi_id',
        'coa',
        'coapiutang',
        'coahutang',
        'coagiro',
        'statusaktif',
        'marketing_id',
        'idshipperasal',
        'parentshipper_id',
        'idtipe',
        'idinitial',
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
            if (['created_at', 'updated_at'].includes(field)) {
              qb.orWhereRaw("FORMAT(s.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
                field,
                `%${sanitizedValue}%`,
              ]);
            } else if (
              ['tgllahir', 'tglemailshipperjobminus'].includes(field)
            ) {
              qb.orWhereRaw("FORMAT(s.??, 'dd-MM-yyyy') like ?", [
                field,
                `%${sanitizedValue}%`,
              ]);
            } else if (field === 'memo' || field === 'text') {
              qb.orWhere(`p.${field}`, 'like', `%${sanitizedValue}%`);
            } else if (field === 'coa_text') {
              qb.orWhere('q.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (field === 'coapiutang_text') {
              qb.orWhere('q2.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (field === 'coahutang_text') {
              qb.orWhere('q3.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (field === 'coagiro_text') {
              qb.orWhere('q4.keterangancoa', 'like', `%${sanitizedValue}%`);
            } else if (field === 'shipperasal_text') {
              qb.orWhere('s1.nama', 'like', `%${sanitizedValue}%`);
            } else if (field === 'parentshipper_text') {
              qb.orWhere('s2.nama', 'like', `%${sanitizedValue}%`);
            } else if (field === 'marketing_text') {
              qb.orWhere('m.nama', 'like', `%${sanitizedValue}%`);
            } else if (field.endsWith('_nama') || field.endsWith('_memo')) {
              const baseField = field.replace(/_nama$|_memo$/, '');
              if (pvtCols.includes(baseField)) {
                qb.orWhere(`pvt.${field}`, 'like', `%${sanitizedValue}%`);
              }
            } else if (pvtCols.includes(field)) {
              qb.orWhere(`pvt.${field}`, 'like', `%${sanitizedValue}%`);
              qb.orWhere(`pvt.${field}_nama`, 'like', `%${sanitizedValue}%`);
              qb.orWhere(`pvt.${field}_memo`, 'like', `%${sanitizedValue}%`);
            } else {
              qb.orWhere(`s.${field}`, 'like', `%${sanitizedValue}%`);
            }
          });
        });
      }

      // --- FILTER ---
      if (filters) {
        for (const [key, rawValue] of Object.entries(filters)) {
          if (!rawValue) continue;
          const val = `%${String(rawValue)}%`;

          const base = key.replace(/(_nama|_memo)$/, '');
          const isPivot = pvtCols.includes(base);

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
            query.andWhereRaw("FORMAT(s.??, 'dd-MM-yyyy HH:mm:ss') like ?", [
              key,
              `%${val}%`,
            ]);
          } else if (
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
              'titipke',
              'rt',
              'rw',
              'kelurahan',
              'kabupaten',
              'kecamatan',
              'propinsi',
              'usertracing',
              'passwordtracing',
              'kodeprospek',
              'nshipperprospek',
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
              'modifiedby',
            ].includes(key)
          ) {
            query.andWhere(`s.${key}`, 'like', `%${val}%`);
          } else if (
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
              'ppnbatalmuat',
              'formatdeliveryreport',
              'marketing_id',
              'isdpp10psn',
              'saldopiutang',
              'idshipperasal',
              'idtipe',
              'idinitial',
              'parentshipper_id',
              'statusaktif',
            ].includes(key)
          ) {
            const num = Number(rawValue);
            if (!isNaN(num)) {
              query.andWhere(`s.${key}`, num);
            }
          } else if (isPivot) {
            if (key.endsWith('_nama')) {
              query.andWhere(`pvt.${base}`, 'like', val);
            } else {
              query.andWhere(`pvt.${base}`, 'like', val);
            }
          } else {
            query.andWhere(`s.${key}`, 'like', val);
          }
        }
      }

      // --- SORT ---
      if (sort?.sortBy && sort?.sortDirection) {
        const { sortBy, sortDirection } = sort;
        const base = sortBy.replace(/(_nama|_memo)$/, '');
        const isPivot = pvtCols.includes(base) || pvtCols.includes(sortBy);

        if (isPivot) {
          if (pvtCols.includes(sortBy)) {
            query.orderBy(`pvt.${sortBy}`, sortDirection);
          } else if (sortBy.endsWith('_nama')) {
            query.orderBy(`pvt.${base}_nama`, sortDirection);
          } else if (sortBy.endsWith('_memo')) {
            query.orderBy(`pvt.${base}_memo`, sortDirection);
          } else {
            query.orderBy(`pvt.${base}`, sortDirection);
          }
        } else {
          query.orderBy(sort.sortBy, sort.sortDirection);
        }
      }

      // Pagination
      if (limit > 0) {
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
      }

      const result = await trx(this.tableName).count('id as total').first();
      const total = result?.total as number;
      const totalPages = Math.ceil(total / (limit || total));
      const data = await query;
      const responseType = Number(total) > 500 ? 'json' : 'local';

      return {
        data,
        type: responseType,
        total,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalItems: total,
          itemsPerPage: limit > 0 ? limit : total,
        },
      };
    } catch (error) {
      console.error('Error to findAll Shipper', error);
      throw new Error(error);
    }
  }

  // async tempStatusPendukung(trx: any, tablename: string) {
  //   try {
  //     const tempStatusPendukung = `##temp_${Math.random().toString(36).substring(2, 15)}`;
  //     const tempData = `##temp_data${Math.random().toString(36).substring(2, 15)}`;
  //     const tempHasil = `##temp_hasil${Math.random().toString(36).substring(2, 15)}`;

  //     await trx.schema.createTable(tempStatusPendukung, (t) => {
  //       t.bigInteger('id').nullable();
  //       t.bigInteger('statusdatapendukung').nullable();
  //       t.bigInteger('transaksi_id').nullable();
  //       t.string('statuspendukung').nullable();
  //       t.text('keterangan').nullable();
  //       t.string('modifiedby').nullable();
  //       t.string('updated_at').nullable();
  //       t.string('created_at').nullable();
  //     });

  //     await trx.schema.createTable(tempData, (t) => {
  //       t.bigInteger('id').nullable();
  //       t.text('keterangan').nullable();
  //       t.string('judul').nullable();
  //     });

  //     await trx.schema.createTable(tempHasil, (t) => {
  //       t.bigInteger('id').nullable();
  //       t.text('statustidakasuransi').nullable();
  //       t.text('statustidakasuransi_nama').nullable();
  //       t.text('statustidakasuransi_memo').nullable();
  //       t.text('asuransi_tas').nullable();
  //       t.text('asuransi_tas_nama').nullable();
  //       t.text('asuransi_tas_memo').nullable();
  //       t.text('top_field').nullable();
  //       t.text('top_field_nama').nullable();
  //       t.text('top_field_memo').nullable();
  //       t.text('open_field').nullable();
  //       t.text('open_field_nama').nullable();
  //       t.text('open_field_memo').nullable();
  //       t.text('bongkaran').nullable();
  //       t.text('bongkaran_nama').nullable();
  //       t.text('bongkaran_memo').nullable();
  //       t.text('delivery_report').nullable();
  //       t.text('delivery_report_nama').nullable();
  //       t.text('delivery_report_memo').nullable();
  //       t.text('final_asuransi_bulan').nullable();
  //       t.text('final_asuransi_bulan_nama').nullable();
  //       t.text('final_asuransi_bulan_memo').nullable();
  //       t.text('job_banyak_invoice').nullable();
  //       t.text('job_banyak_invoice_nama').nullable();
  //       t.text('job_banyak_invoice_memo').nullable();
  //       t.text('job_pajak').nullable();
  //       t.text('job_pajak_nama').nullable();
  //       t.text('job_pajak_memo').nullable();
  //       t.text('cetak_keterangan_shipper').nullable();
  //       t.text('cetak_keterangan_shipper_nama').nullable();
  //       t.text('cetak_keterangan_shipper_memo').nullable();
  //       t.text('fumigasi').nullable();
  //       t.text('fumigasi_nama').nullable();
  //       t.text('fumigasi_memo').nullable();
  //       t.text('adjust_tagih_warkat').nullable();
  //       t.text('adjust_tagih_warkat_nama').nullable();
  //       t.text('adjust_tagih_warkat_memo').nullable();
  //       t.text('job_non_ppn').nullable();
  //       t.text('job_non_ppn_nama').nullable();
  //       t.text('job_non_ppn_memo').nullable();
  //       t.text('approval_pajakp_pisah_ongkos').nullable();
  //       t.text('approval_pajakp_pisah_ongkos_nama').nullable();
  //       t.text('approval_pajakp_pisah_ongkos_memo').nullable();
  //       t.text('decimal_invoice').nullable();
  //       t.text('decimal_invoice_nama').nullable();
  //       t.text('decimal_invoice_memo').nullable();
  //       t.text('reimbursement').nullable();
  //       t.text('reimbursement_nama').nullable();
  //       t.text('reimbursement_memo').nullable();
  //       t.text('not_invoice_tambahan').nullable();
  //       t.text('not_invoice_tambahan_nama').nullable();
  //       t.text('not_invoice_tambahan_memo').nullable();
  //       t.text('invoice_jasa_pengurusan_transportasi').nullable();
  //       t.text('invoice_jasa_pengurusan_transportasi_nama').nullable();
  //       t.text('invoice_jasa_pengurusan_transportasi_memo').nullable();
  //       t.text('not_ucase_shipper').nullable();
  //       t.text('not_ucase_shipper_nama').nullable();
  //       t.text('not_ucase_shipper_memo').nullable();
  //       t.text('shipper_sttb').nullable();
  //       t.text('shipper_sttb_nama').nullable();
  //       t.text('shipper_sttb_memo').nullable();
  //       t.text('shipper_cabang').nullable();
  //       t.text('shipper_cabang_nama').nullable();
  //       t.text('shipper_cabang_memo').nullable();
  //       t.text('spk').nullable();
  //       t.text('spk_nama').nullable();
  //       t.text('spk_memo').nullable();
  //       t.text('ppn_warkat_eksport').nullable();
  //       t.text('ppn_warkat_eksport_nama').nullable();
  //       t.text('ppn_warkat_eksport_memo').nullable();
  //       t.text('ppn_11').nullable();
  //       t.text('ppn_11_nama').nullable();
  //       t.text('ppn_11_memo').nullable();
  //       t.text('non_prospek').nullable();
  //       t.text('non_prospek_nama').nullable();
  //       t.text('non_prospek_memo').nullable();
  //       t.text('info_delay').nullable();
  //       t.text('info_delay_nama').nullable();
  //       t.text('info_delay_memo').nullable();
  //       t.text('job_minus').nullable();
  //       t.text('job_minus_nama').nullable();
  //       t.text('job_minus_memo').nullable();
  //       t.text('shipper_sendiri').nullable();
  //       t.text('shipper_sendiri_nama').nullable();
  //       t.text('shipper_sendiri_memo').nullable();
  //       t.text('wajib_invoice_sebelum_biaya').nullable();
  //       t.text('wajib_invoice_sebelum_biaya_nama').nullable();
  //       t.text('wajib_invoice_sebelum_biaya_memo').nullable();
  //       t.text('tanpa_nik_npwp').nullable();
  //       t.text('tanpa_nik_npwp_nama').nullable();
  //       t.text('tanpa_nik_npwp_memo').nullable();
  //       t.text('pusat').nullable();
  //       t.text('pusat_nama').nullable();
  //       t.text('pusat_memo').nullable();
  //       t.text('app_saldo_piutang').nullable();
  //       t.text('app_saldo_piutang_nama').nullable();
  //       t.text('app_saldo_piutang_memo').nullable();
  //       t.text('nama_paraf').nullable();
  //       t.text('nama_paraf_nama').nullable();
  //       t.text('nama_paraf_memo').nullable();
  //       t.text('not_order_trucking').nullable();
  //       t.text('not_order_trucking_nama').nullable();
  //       t.text('not_order_trucking_memo').nullable();
  //       t.text('passport').nullable();
  //       t.text('passport_nama').nullable();
  //       t.text('passport_memo').nullable();
  //       t.text('ppn_kunci').nullable();
  //       t.text('ppn_kunci_nama').nullable();
  //       t.text('ppn_kunci_memo').nullable();
  //       t.text('approval_shipper_job_minus').nullable();
  //       t.text('approval_shipper_job_minus_nama').nullable();
  //       t.text('approval_shipper_job_minus_memo').nullable();
  //       t.text('approval_top').nullable();
  //       t.text('approval_top_nama').nullable();
  //       t.text('approval_top_memo').nullable();
  //       t.text('blacklist_shipper').nullable();
  //       t.text('blacklist_shipper_nama').nullable();
  //       t.text('blacklist_shipper_memo').nullable();
  //       t.text('non_lapor_pajak').nullable();
  //       t.text('non_lapor_pajak_nama').nullable();
  //       t.text('non_lapor_pajak_memo').nullable();
  //       t.text('shipper_potongan').nullable();
  //       t.text('shipper_potongan_nama').nullable();
  //       t.text('shipper_potongan_memo').nullable();
  //       t.text('shipper_tidak_tagih_invoice_utama').nullable();
  //       t.text('shipper_tidak_tagih_invoice_utama_nama').nullable();
  //       t.text('shipper_tidak_tagih_invoice_utama_memo').nullable();
  //       t.text('not_tampil_web').nullable();
  //       t.text('not_tampil_web_nama').nullable();
  //       t.text('not_tampil_web_memo').nullable();
  //       t.text('not_free_admin').nullable();
  //       t.text('not_free_admin_nama').nullable();
  //       t.text('not_free_admin_memo').nullable();
  //       t.text('non_reimbursement').nullable();
  //       t.text('non_reimbursement_nama').nullable();
  //       t.text('non_reimbursement_memo').nullable();
  //       t.text('app_cetak_invoice_lain').nullable();
  //       t.text('app_cetak_invoice_lain_nama').nullable();
  //       t.text('app_cetak_invoice_lain_memo').nullable();
  //       t.text('lewat_hitung_ulang_ppn').nullable();
  //       t.text('lewat_hitung_ulang_ppn_nama').nullable();
  //       t.text('lewat_hitung_ulang_ppn_memo').nullable();
  //       t.text('online').nullable();
  //       t.text('online_nama').nullable();
  //       t.text('online_memo').nullable();
  //       t.text('keterangan_buruh').nullable();
  //       t.text('keterangan_buruh_nama').nullable();
  //       t.text('keterangan_buruh_memo').nullable();
  //       t.text('edit_keterangan_invoice_utama').nullable();
  //       t.text('edit_keterangan_invoice_utama_nama').nullable();
  //       t.text('edit_keterangan_invoice_utama_memo').nullable();
  //       t.text('tampil_keterangan_tambahan_sttb').nullable();
  //       t.text('tampil_keterangan_tambahan_sttb_nama').nullable();
  //       t.text('tampil_keterangan_tambahan_sttb_memo').nullable();
  //       t.text('update_ppn_shiper_khusus').nullable();
  //       t.text('update_ppn_shiper_khusus_nama').nullable();
  //       t.text('update_ppn_shiper_khusus_memo').nullable();
  //       t.text('shipper_rincian').nullable();
  //       t.text('shipper_rincian_nama').nullable();
  //       t.text('shipper_rincian_memo').nullable();
  //       t.text('national_id').nullable();
  //       t.text('national_id_nama').nullable();
  //       t.text('national_id_memo').nullable();
  //       t.text('refdesc_po').nullable();
  //       t.text('refdesc_po_nama').nullable();
  //       t.text('refdesc_po_memo').nullable();
  //     });

  //     await trx(tempStatusPendukung).insert(
  //       trx
  //         .select(
  //           'a.id',
  //           'a.statusdatapendukung',
  //           'a.transaksi_id',
  //           'a.statuspendukung',
  //           'a.keterangan',
  //           'a.modifiedby',
  //           'a.updated_at',
  //           'a.created_at',
  //         )
  //         .from('statuspendukung as a')
  //         .innerJoin('parameter as b', 'a.statusdatapendukung', 'b.id')
  //         .where('b.subgrp', tablename),
  //     );

  //     await trx(tempData).insert(
  //       trx
  //         .select(
  //           'a.id',
  //           trx.raw(
  //             `CONCAT(
  //               '{"statusdatapendukung":"',
  //               CASE
  //                 WHEN ISJSON(CAST(c.memo AS NVARCHAR(MAX))) = 1
  //                   THEN JSON_VALUE(CAST(c.memo AS NVARCHAR(MAX)), '$.MEMO')
  //                 ELSE ''
  //               END,
  //               '","transaksi_id":',
  //               TRIM(STR(ISNULL(b.transaksi_id, 0))),
  //               ',"statuspendukung":"',
  //               CASE
  //                 WHEN ISJSON(CAST(d.memo AS NVARCHAR(MAX))) = 1
  //                   THEN JSON_VALUE(CAST(d.memo AS NVARCHAR(MAX)), '$.MEMO')
  //                 ELSE ''
  //               END,
  //               '","keterangan":"',
  //               TRIM(ISNULL(b.keterangan, '')),
  //               '","updated_at":"',
  //               FORMAT(CAST(b.updated_at AS DATETIME), 'yyyy-MM-dd HH:mm:ss'),
  //               '","statuspendukung_id":"',
  //               TRIM(STR(ISNULL(d.id, 0))),
  //               '","statuspendukung_memo":',
  //              TRIM(CAST(d.memo AS NVARCHAR(MAX))),
  //               '}'
  //             ) AS keterangan`,
  //           ),
  //           trx.raw(
  //             `CASE
  //               WHEN ISJSON(CAST(c.memo AS NVARCHAR(MAX))) = 1
  //                 THEN JSON_VALUE(CAST(c.memo AS NVARCHAR(MAX)), '$.MEMO')
  //               ELSE ''
  //             END AS judul`,
  //           ),
  //         )
  //         .from(`${tablename} as a`)
  //         .innerJoin(`${tempStatusPendukung} as b`, 'a.id', 'b.transaksi_id')
  //         .innerJoin('parameter as c', 'b.statusdatapendukung', 'c.id')
  //         .innerJoin('parameter as d', 'b.statuspendukung', 'd.id'),
  //     );

  //     const columnsResult = await trx
  //       .select('judul')
  //       .from(tempData)
  //       .groupBy('judul');

  //     let columns = '';
  //     columnsResult.forEach((row, index) => {
  //       if (index === 0) {
  //         columns = `[${row.judul}]`;
  //       } else {
  //         columns += `, [${row.judul}]`;
  //       }
  //     });
  //     // console.log('columns',columns);

  //     if (!columns) {
  //       throw new Error('No columns generated for PIVOT');
  //     }

  //     const safeColumns = columns
  //       .replace(/\[TOP\]/gi, '[TOP_FIELD]')
  //       .replace(/\[OPEN\]/gi, '[OPEN_FIELD]');

  //     const pivotSubqueryRaw = `
  //       (
  //         SELECT id, ${safeColumns}
  //         FROM (
  //           SELECT
  //             id,
  //             CASE
  //               WHEN judul = 'TOP' THEN 'TOP_FIELD'
  //               WHEN judul = 'OPEN' THEN 'OPEN_FIELD'
  //               ELSE judul
  //             END AS judul,
  //             keterangan
  //           FROM ${tempData}
  //         ) AS SourceTable
  //         PIVOT (
  //           MAX(keterangan)
  //           FOR judul IN (${safeColumns})
  //         ) AS PivotTable
  //       ) AS A
  //     `;

  //     await trx(tempHasil).insert(
  //       trx
  //         .select([
  //           'A.id',
  //           trx.raw(
  //             "JSON_VALUE(A.[TIDAK ASURANSI], '$.statuspendukung_id') as statustidakasuransi",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[TIDAK ASURANSI], '$.statuspendukung') as statustidakasuransi_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[TIDAK ASURANSI], '$.statuspendukung_memo') as statustidakasuransi_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[ASURANSI TAS], '$.statuspendukung_id') as asuransi_tas",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[ASURANSI TAS], '$.statuspendukung') as asuransi_tas_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[ASURANSI TAS], '$.statuspendukung_memo') as asuransi_tas_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[TOP_FIELD], '$.statuspendukung_id') as top_field",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[TOP_FIELD], '$.statuspendukung') as top_field_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[TOP_FIELD], '$.statuspendukung_memo') as top_field_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[OPEN_FIELD], '$.statuspendukung_id') as open_field",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[OPEN_FIELD], '$.statuspendukung') as open_field_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[OPEN_FIELD], '$.statuspendukung_memo') as open_field_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[BONGKARAN], '$.statuspendukung_id') as bongkaran",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[BONGKARAN], '$.statuspendukung') as bongkaran_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[BONGKARAN], '$.statuspendukung_memo') as bongkaran_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[DELIVERY REPORT], '$.statuspendukung_id') as delivery_report",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[DELIVERY REPORT], '$.statuspendukung') as delivery_report_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[DELIVERY REPORT], '$.statuspendukung_memo') as delivery_report_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[FINAL ASURANSI BULAN], '$.statuspendukung_id') as final_asuransi_bulan",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[FINAL ASURANSI BULAN], '$.statuspendukung') as final_asuransi_bulan_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[FINAL ASURANSI BULAN], '$.statuspendukung_memo') as final_asuransi_bulan_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[JOB BANYAK INVOICE], '$.statuspendukung_id') as job_banyak_invoice",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[JOB BANYAK INVOICE], '$.statuspendukung') as job_banyak_invoice_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[JOB BANYAK INVOICE], '$.statuspendukung_memo') as job_banyak_invoice_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[JOB PAJAK], '$.statuspendukung_id') as job_pajak",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[JOB PAJAK], '$.statuspendukung') as job_pajak_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[JOB PAJAK], '$.statuspendukung_memo') as job_pajak_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[CETAK KETERANGAN SHIPPER], '$.statuspendukung_id') as cetak_keterangan_shipper",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[CETAK KETERANGAN SHIPPER], '$.statuspendukung') as cetak_keterangan_shipper_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[CETAK KETERANGAN SHIPPER], '$.statuspendukung_memo') as cetak_keterangan_shipper_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[FUMIGASI], '$.statuspendukung_id') as fumigasi",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[FUMIGASI], '$.statuspendukung') as fumigasi_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[FUMIGASI], '$.statuspendukung_memo') as fumigasi_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[ADJUST TAGIH WARKAT], '$.statuspendukung_id') as adjust_tagih_warkat",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[ADJUST TAGIH WARKAT], '$.statuspendukung') as adjust_tagih_warkat_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[ADJUST TAGIH WARKAT], '$.statuspendukung_memo') as adjust_tagih_warkat_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[JOB NON PPN], '$.statuspendukung_id') as job_non_ppn",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[JOB NON PPN], '$.statuspendukung') as job_non_ppn_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[JOB NON PPN], '$.statuspendukung_memo') as job_non_ppn_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[APPROVAL PAJAKP PISAH ONGKOS], '$.statuspendukung_id') as approval_pajakp_pisah_ongkos",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[APPROVAL PAJAKP PISAH ONGKOS], '$.statuspendukung') as approval_pajakp_pisah_ongkos_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[APPROVAL PAJAKP PISAH ONGKOS], '$.statuspendukung_memo') as approval_pajakp_pisah_ongkos_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[DECIMAL INVOICE], '$.statuspendukung_id') as decimal_invoice",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[DECIMAL INVOICE], '$.statuspendukung') as decimal_invoice_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[DECIMAL INVOICE], '$.statuspendukung_memo') as decimal_invoice_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[REIMBURSEMENT], '$.statuspendukung_id') as reimbursement",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[REIMBURSEMENT], '$.statuspendukung') as reimbursement_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[REIMBURSEMENT], '$.statuspendukung_memo') as reimbursement_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NOT INVOICE TAMBAHAN], '$.statuspendukung_id') as not_invoice_tambahan",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NOT INVOICE TAMBAHAN], '$.statuspendukung') as not_invoice_tambahan_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[NOT INVOICE TAMBAHAN], '$.statuspendukung_memo') as not_invoice_tambahan_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[INVOICE JASA PENGURUSAN TRANSPORTASI], '$.statuspendukung_id') as invoice_jasa_pengurusan_transportasi",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[INVOICE JASA PENGURUSAN TRANSPORTASI], '$.statuspendukung') as invoice_jasa_pengurusan_transportasi_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[INVOICE JASA PENGURUSAN TRANSPORTASI], '$.statuspendukung_memo') as invoice_jasa_pengurusan_transportasi_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NOT UCASE SHIPPER], '$.statuspendukung_id') as not_ucase_shipper",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NOT UCASE SHIPPER], '$.statuspendukung') as not_ucase_shipper_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[NOT UCASE SHIPPER], '$.statuspendukung_memo') as not_ucase_shipper_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER STTB], '$.statuspendukung_id') as shipper_sttb",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER STTB], '$.statuspendukung') as shipper_sttb_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[SHIPPER STTB], '$.statuspendukung_memo') as shipper_sttb_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER CABANG], '$.statuspendukung_id') as shipper_cabang",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER CABANG], '$.statuspendukung') as shipper_cabang_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[SHIPPER CABANG], '$.statuspendukung_memo') as shipper_cabang_memo",
  //           ),
  //           trx.raw("JSON_VALUE(A.[SPK], '$.statuspendukung_id') as spk"),
  //           trx.raw("JSON_VALUE(A.[SPK], '$.statuspendukung') as spk_nama"),
  //           trx.raw(
  //             "JSON_QUERY(A.[SPK], '$.statuspendukung_memo') as spk_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[PPN WARKAT EKSPORT], '$.statuspendukung_id') as ppn_warkat_eksport",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[PPN WARKAT EKSPORT], '$.statuspendukung') as ppn_warkat_eksport_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[PPN WARKAT EKSPORT], '$.statuspendukung_memo') as ppn_warkat_eksport_memo",
  //           ),
  //           trx.raw("JSON_VALUE(A.[PPN 11], '$.statuspendukung_id') as ppn_11"),
  //           trx.raw(
  //             "JSON_VALUE(A.[PPN 11], '$.statuspendukung') as ppn_11_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[PPN 11], '$.statuspendukung_memo') as ppn_11_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NON PROSPEK], '$.statuspendukung_id') as non_prospek",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NON PROSPEK], '$.statuspendukung') as non_prospek_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[NON PROSPEK], '$.statuspendukung_memo') as non_prospek_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[INFO DELAY], '$.statuspendukung_id') as info_delay",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[INFO DELAY], '$.statuspendukung') as info_delay_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[INFO DELAY], '$.statuspendukung_memo') as info_delay_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[JOB MINUS], '$.statuspendukung_id') as job_minus",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[JOB MINUS], '$.statuspendukung') as job_minus_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[JOB MINUS], '$.statuspendukung_memo') as job_minus_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER SENDIRI], '$.statuspendukung_id') as shipper_sendiri",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER SENDIRI], '$.statuspendukung') as shipper_sendiri_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[SHIPPER SENDIRI], '$.statuspendukung_memo') as shipper_sendiri_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[WAJIB INVOICE SEBELUM BIAYA], '$.statuspendukung_id') as wajib_invoice_sebelum_biaya",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[WAJIB INVOICE SEBELUM BIAYA], '$.statuspendukung') as wajib_invoice_sebelum_biaya_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[WAJIB INVOICE SEBELUM BIAYA], '$.statuspendukung_memo') as wajib_invoice_sebelum_biaya_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[TANPA NIK NPWP], '$.statuspendukung_id') as tanpa_nik_npwp",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[TANPA NIK NPWP], '$.statuspendukung') as tanpa_nik_npwp_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[TANPA NIK NPWP], '$.statuspendukung_memo') as tanpa_nik_npwp_memo",
  //           ),
  //           trx.raw("JSON_VALUE(A.[PUSAT], '$.statuspendukung_id') as pusat"),
  //           trx.raw("JSON_VALUE(A.[PUSAT], '$.statuspendukung') as pusat_nama"),
  //           trx.raw(
  //             "JSON_QUERY(A.[PUSAT], '$.statuspendukung_memo') as pusat_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[APP SALDO PIUTANG], '$.statuspendukung_id') as app_saldo_piutang",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[APP SALDO PIUTANG], '$.statuspendukung') as app_saldo_piutang_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[APP SALDO PIUTANG], '$.statuspendukung_memo') as app_saldo_piutang_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NAMA PARAF], '$.statuspendukung_id') as nama_paraf",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NAMA PARAF], '$.statuspendukung') as nama_paraf_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[NAMA PARAF], '$.statuspendukung_memo') as nama_paraf_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NOT ORDER TRUCKING], '$.statuspendukung_id') as not_order_trucking",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NOT ORDER TRUCKING], '$.statuspendukung') as not_order_trucking_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[NOT ORDER TRUCKING], '$.statuspendukung_memo') as not_order_trucking_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[PASSPORT], '$.statuspendukung_id') as passport",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[PASSPORT], '$.statuspendukung') as passport_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[PASSPORT], '$.statuspendukung_memo') as passport_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[PPN KUNCI], '$.statuspendukung_id') as ppn_kunci",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[PPN KUNCI], '$.statuspendukung') as ppn_kunci_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[PPN KUNCI], '$.statuspendukung_memo') as ppn_kunci_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[APPROVAL SHIPPER JOB MINUS], '$.statuspendukung_id') as approval_shipper_job_minus",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[APPROVAL SHIPPER JOB MINUS], '$.statuspendukung') as approval_shipper_job_minus_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[APPROVAL SHIPPER JOB MINUS], '$.statuspendukung_memo') as approval_shipper_job_minus_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[APPROVAL TOP], '$.statuspendukung_id') as approval_top",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[APPROVAL TOP], '$.statuspendukung') as approval_top_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[APPROVAL TOP], '$.statuspendukung_memo') as approval_top_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[BLACKLIST SHIPPER], '$.statuspendukung_id') as blacklist_shipper",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[BLACKLIST SHIPPER], '$.statuspendukung') as blacklist_shipper_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[BLACKLIST SHIPPER], '$.statuspendukung_memo') as blacklist_shipper_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NON LAPOR PAJAK], '$.statuspendukung_id') as non_lapor_pajak",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NON LAPOR PAJAK], '$.statuspendukung') as non_lapor_pajak_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[NON LAPOR PAJAK], '$.statuspendukung_memo') as non_lapor_pajak_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER POTONGAN], '$.statuspendukung_id') as shipper_potongan",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER POTONGAN], '$.statuspendukung') as shipper_potongan_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[SHIPPER POTONGAN], '$.statuspendukung_memo') as shipper_potongan_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER TIDAK TAGIH INVOICE UTAMA], '$.statuspendukung_id') as shipper_tidak_tagih_invoice_utama",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER TIDAK TAGIH INVOICE UTAMA], '$.statuspendukung') as shipper_tidak_tagih_invoice_utama_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[SHIPPER TIDAK TAGIH INVOICE UTAMA], '$.statuspendukung_memo') as shipper_tidak_tagih_invoice_utama_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NOT TAMPIL WEB], '$.statuspendukung_id') as not_tampil_web",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NOT TAMPIL WEB], '$.statuspendukung') as not_tampil_web_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[NOT TAMPIL WEB], '$.statuspendukung_memo') as not_tampil_web_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NOT FREE ADMIN], '$.statuspendukung_id') as not_free_admin",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NOT FREE ADMIN], '$.statuspendukung') as not_free_admin_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[NOT FREE ADMIN], '$.statuspendukung_memo') as not_free_admin_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NON REIMBURSEMENT], '$.statuspendukung_id') as non_reimbursement",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NON REIMBURSEMENT], '$.statuspendukung') as non_reimbursement_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[NON REIMBURSEMENT], '$.statuspendukung_memo') as non_reimbursement_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[APP CETAK INVOICE LAIN], '$.statuspendukung_id') as app_cetak_invoice_lain",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[APP CETAK INVOICE LAIN], '$.statuspendukung') as app_cetak_invoice_lain_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[APP CETAK INVOICE LAIN], '$.statuspendukung_memo') as app_cetak_invoice_lain_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[LEWAT HITUNG ULANG PPN], '$.statuspendukung_id') as lewat_hitung_ulang_ppn",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[LEWAT HITUNG ULANG PPN], '$.statuspendukung') as lewat_hitung_ulang_ppn_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[LEWAT HITUNG ULANG PPN], '$.statuspendukung_memo') as lewat_hitung_ulang_ppn_memo",
  //           ),
  //           trx.raw("JSON_VALUE(A.[ONLINE], '$.statuspendukung_id') as online"),
  //           trx.raw(
  //             "JSON_VALUE(A.[ONLINE], '$.statuspendukung') as online_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[ONLINE], '$.statuspendukung_memo') as online_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[KETERANGAN BURUH], '$.statuspendukung_id') as keterangan_buruh",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[KETERANGAN BURUH], '$.statuspendukung') as keterangan_buruh_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[KETERANGAN BURUH], '$.statuspendukung_memo') as keterangan_buruh_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[EDIT KETERANGAN INVOICE UTAMA], '$.statuspendukung_id') as edit_keterangan_invoice_utama",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[EDIT KETERANGAN INVOICE UTAMA], '$.statuspendukung') as edit_keterangan_invoice_utama_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[EDIT KETERANGAN INVOICE UTAMA], '$.statuspendukung_memo') as edit_keterangan_invoice_utama_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[TAMPIL KETERANGAN TAMBAHAN STTB], '$.statuspendukung_id') as tampil_keterangan_tambahan_sttb",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[TAMPIL KETERANGAN TAMBAHAN STTB], '$.statuspendukung') as tampil_keterangan_tambahan_sttb_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[TAMPIL KETERANGAN TAMBAHAN STTB], '$.statuspendukung_memo') as tampil_keterangan_tambahan_sttb_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[UPDATE PPN SHIPER KHUSUS], '$.statuspendukung_id') as update_ppn_shiper_khusus",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[UPDATE PPN SHIPER KHUSUS], '$.statuspendukung') as update_ppn_shiper_khusus_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[UPDATE PPN SHIPER KHUSUS], '$.statuspendukung_memo') as update_ppn_shiper_khusus_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER RINCIAN], '$.statuspendukung_id') as shipper_rincian",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[SHIPPER RINCIAN], '$.statuspendukung') as shipper_rincian_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[SHIPPER RINCIAN], '$.statuspendukung_memo') as shipper_rincian_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NATIONAL ID], '$.statuspendukung_id') as national_id",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[NATIONAL ID], '$.statuspendukung') as national_id_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[NATIONAL ID], '$.statuspendukung_memo') as national_id_memo",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[REFDESC PO], '$.statuspendukung_id') as refdesc_po",
  //           ),
  //           trx.raw(
  //             "JSON_VALUE(A.[REFDESC PO], '$.statuspendukung') as refdesc_po_nama",
  //           ),
  //           trx.raw(
  //             "JSON_QUERY(A.[REFDESC PO], '$.statuspendukung_memo') as refdesc_po_memo",
  //           ),
  //         ])
  //         .from(trx.raw(pivotSubqueryRaw)),
  //     );

  //     return tempHasil;
  //   } catch (error) {
  //     console.error('Error fetching data shipper pvt hardcore:', error);
  //     throw new Error('Failed to fetch shipper pvt');
  //   }
  // }

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
