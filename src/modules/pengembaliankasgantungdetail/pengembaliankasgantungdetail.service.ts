import { Injectable } from '@nestjs/common';
import { CreatePengembaliankasgantungdetailDto } from './dto/create-pengembaliankasgantungdetail.dto';
import { UpdatePengembaliankasgantungdetailDto } from './dto/update-pengembaliankasgantungdetail.dto';
import { dbBunga } from 'src/common/utils/db';

@Injectable()
export class PengembaliankasgantungdetailService {
  create(
    createPengembaliankasgantungdetailDto: CreatePengembaliankasgantungdetailDto,
  ) {
    return 'This action adds a new pengembaliankasgantungdetail';
  }

  async findAll(tgldari: string, tglsampai: string) {
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Tambahkan 1 karena bulan di JavaScript dimulai dari 0
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formattedTglDari = formatDate(tgldari);
    const formattedTglSampai = formatDate(tglsampai);

    console.log(formattedTglDari, formattedTglSampai);

    const tempTableName = `cuti_approval_cache_${Date.now()}`;
    const tempsuratpengantar1 = `tempsuratpengantar1${Date.now()}`;
    await dbBunga.schema.createTable(tempsuratpengantar1, (table) => {
      table.integer('id').nullable();
    });
    await dbBunga(tempsuratpengantar1).insert(
      dbBunga('suratpengantar as u').select('u.id'),
    );
    // Membuat tabel sementara
    await dbBunga.schema.createTable(tempTableName, (table) => {
      table.integer('id').nullable();
      table.integer('idoriginal').nullable();
      table.string('jobtrucking', 50).nullable();
      table.string('nobukti', 50).nullable();
      table.string('tglbukti').nullable();
      table.string('nosp', 50).nullable();
      table.string('tglsp').nullable();
      table.string('nojob', 50).nullable();
      table.string('pelanggan_id').nullable();
      table.text('keterangan').nullable();
      table.string('dari_id').nullable();
      table.string('sampai_id').nullable();
      table.decimal('gajisupir', 15, 2).nullable();
      table.decimal('jarak', 15, 2).nullable();
      table.text('penyesuaian').nullable();
      table.string('agen_id').nullable();
      table.string('jenisorder_id').nullable();
      table.string('container_id').nullable();
      table.string('nocont').nullable();
      table.string('noseal').nullable();
      table.string('statuscontainer_id').nullable();
      table.string('gudang').nullable();
      table.string('trado_id').nullable();
      table.string('gandengan_id').nullable();
      table.text('statuslongtrip').nullable();
      table.text('statuslongtriptext').nullable();
      table.text('statusperalihan').nullable();
      table.text('statusperalihantext').nullable();
      table.text('statusritasiomset').nullable();
      table.text('statusapprovalmandor').nullable();
      table.text('statusapprovalmandortext').nullable();
      table.string('tglapprovalmandor').nullable();
      table.string('userapprovalmandor').nullable();
      table.string('tarif_id').nullable();
      table.string('mandortrado_id').nullable();
      table.string('mandorsupir_id').nullable();
      table.text('statusgudangsama').nullable();
      table.text('statusgudangsamatext').nullable();
      table.text('statusbatalmuat').nullable();
      table.text('statusbatalmuattext').nullable();
      table.string('modifiedby').nullable();
      table.string('created_at').nullable();
      table.string('updated_at').nullable();
      table.integer('flag').nullable();
    });
    // Gunakan insert dengan select langsung
    const query = await dbBunga('suratpengantar as u')
      .select(
        'u.id',
        'u.id as idoriginal',
        'u.jobtrucking',
        'u.nobukti',
        'u.tglbukti',
        'u.nosp',
        'u.tglsp',
        'u.nojob',
        'p.namapelanggan as pelanggan_id',
        'u.keterangan',
        'kd.kodekota as dari_id',
        'ks.kodekota as sampai_id',
        'u.gajisupir',
        'u.jarak',
        'u.penyesuaian',
        'a.namaagen as agen_id',
        'jo.keterangan as jenisorder_id',
        'c.keterangan as container_id',
        'u.nocont',
        'u.noseal',
        'sc.keterangan as statuscontainer_id',
        'u.gudang',
        't.kodetrado as trado_id',
        'g.keterangan as gandengan_id',
        'sl.memo as statuslongtrip',
        'sl.text as statuslongtriptext',
        'sp.memo as statusperalihan',
        'sp.text as statusperalihantext',
        'sro.memo as statusritasiomset',
        'sam.memo as statusapprovalmandor',
        'sam.text as statusapprovalmandortext',
        dbBunga.raw(
          '(case when (year(u.tglapprovalmandor) <= 2000) then null else u.tglapprovalmandor end ) as tglapprovalmandor',
        ),
        'u.userapprovalmandor',
        'ta.tujuan as tarif_id',
        'mt.namamandor as mandortrado_id',
        'ms.namamandor as mandorsupir_id',
        'sg.memo as statusgudangsama',
        'sg.text as statusgudangsamatext',
        'sb.memo as statusbatalmuat',
        'sb.text as statusbatalmuattext',
        'u.modifiedby',
        'u.created_at',
        'u.updated_at',
        dbBunga.raw('1 as flag'),
      )
      .whereBetween('u.tglbukti', [formattedTglDari, formattedTglSampai])
      .leftJoin('pelanggan as p', 'u.pelanggan_id', 'p.id')
      .leftJoin('kota as kd', 'kd.id', '=', 'u.dari_id')
      .leftJoin('kota as ks', 'ks.id', '=', 'u.sampai_id')
      .leftJoin('agen as a', 'u.agen_id', 'a.id')
      .leftJoin('jenisorder as jo', 'u.jenisorder_id', 'jo.id')
      .leftJoin('container as c', 'u.container_id', 'c.id')
      .leftJoin('statuscontainer as sc', 'u.statuscontainer_id', 'sc.id')
      .leftJoin('trado as t', 'u.trado_id', 't.id')
      .leftJoin('supir as s', 'u.supir_id', 's.id')
      .leftJoin('gandengan as g', 'u.gandengan_id', 'g.id')
      .leftJoin('parameter as sl', 'u.statuslongtrip', 'sl.id')
      .leftJoin('parameter as sp', 'u.statusperalihan', 'sp.id')
      .leftJoin('parameter as sro', 'u.statusritasiomset', 'sro.id')
      .leftJoin('parameter as sg', 'u.statusgudangsama', 'sg.id')
      .leftJoin('parameter as sb', 'u.statusbatalmuat', 'sb.id')
      .leftJoin('parameter as sam', 'u.statusapprovalmandor', 'sam.id')
      .leftJoin('mandor as mt', 'u.mandortrado_id', 'mt.id')
      .leftJoin('mandor as ms', 'u.mandorsupir_id', 'ms.id')
      .leftJoin('tarif as ta', 'u.tarif_id', 'ta.id')
      .join(`${tempsuratpengantar1} as sp1`, 'u.id', 'sp1.id');

    // Mengambil data dari tabel sementara
    // const data = await dbBunga(tempTableName);
    return query;
  }

  findOne(id: number) {
    return `This action returns a #${id} pengembaliankasgantungdetail`;
  }

  update(
    id: number,
    updatePengembaliankasgantungdetailDto: UpdatePengembaliankasgantungdetailDto,
  ) {
    return `This action updates a #${id} pengembaliankasgantungdetail`;
  }

  remove(id: number) {
    return `This action removes a #${id} pengembaliankasgantungdetail`;
  }
}
