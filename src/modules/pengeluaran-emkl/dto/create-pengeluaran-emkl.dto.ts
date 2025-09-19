import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';

// ------------------------
// 1. BASE FIELDS
// ------------------------
const baseFields = {
  nama: z.string().min(1, { message: 'Nama Wajib Diisi' }),
  keterangan: z
    .string({ message: 'Keterangan Wajib Diisi' })
    .nonempty({ message: 'Keterangan Wajib Diisi' }),

  coadebet: z.string().nullable().optional(),
  coadebet_nama: z.string().nullable().optional(),

  coakredit: z.string().nullable().optional(),
  coakredit_nama: z.string().nullable().optional(),

  coapostingkasbankdebet: z.string().nullable().optional(),
  coabankdebet_nama: z.string().nullable().optional(),

  coapostingkasbankkredit: z.string().nullable().optional(),
  coabankkredit_nama: z.string().nullable().optional(),

  coapostinghutangdebet: z.string().nullable().optional(),
  coahutangdebet_nama: z.string().nullable().optional(),

  coapostinghutangkredit: z.string().nullable().optional(),
  coahutangkredit_nama: z.string().nullable().optional(),

  coaproses: z.string().nullable().optional(),
  coaproses_nama: z.string().nullable().optional(),

  nilaiproses: z
    .number()
    .int({ message: 'Nilai Proses harus bulat' })
    .min(1, { message: 'Nilai Proses Wajib Diisi' }),
  nilaiproses_nama: z.string().nullable().optional(),

  statuspenarikan: z
    .number()
    .int({ message: 'Status Penarikan harus bulat' })
    .min(1, { message: 'Status Penarikan Wajib Diisi' }),
  statuspenarikan_nama: z.string().nullable().optional(),

  format: z
    .number()
    .int({ message: 'format Wajib Diisi' })
    .min(1, { message: 'format Wajib Diisi' }),
  format_nama: z.string().nullable().optional(),

  statusaktif: z
    .number()
    .int({ message: 'Status Aktif harus bulat' })
    .min(1, { message: 'Status Aktif Wajib Diisi' }),
  statusaktif_nama: z.string().nullable().optional(),

  // modifiedby diisi di backend, optional di request body
  modifiedby: z.string().max(200).optional(),
};

// ------------------------
// 2. KHUSUS CREATE
// ------------------------
export const CreatePengeluaranEmklSchema = z
  .object({
    ...baseFields,
    // Field/aturan khusus create bisa ditambah di sini
  })
  .superRefine(async (data, ctx) => {
    // Cek unik hanya untuk create (excludeId tidak ada)
    const existsName = await isRecordExist(
      'nama',
      data.nama,
      'pengeluaranemkl',
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Pengeluaran EMKL dengan nama ini sudah ada',
      });
    }

    const coaValues = [
      { field: 'coadebet', value: data.coadebet, name: 'COA DEBET' },
      { field: 'coakredit', value: data.coakredit, name: 'COA KREDIT' },
      {
        field: 'coapostingkasbankdebet',
        value: data.coapostingkasbankdebet,
        name: 'COA POSTING KASBANK DEBET',
      },
      {
        field: 'coapostingkasbankkredit',
        value: data.coapostingkasbankkredit,
        name: 'COA POSTING KASBANK KREDIT',
      },
      {
        field: 'coapostinghutangdebet',
        value: data.coapostinghutangdebet,
        name: 'COA POSTING HUTANG DEBET',
      },
      {
        field: 'coapostinghutangkredit',
        value: data.coapostinghutangkredit,
        name: 'COA POSTING HUTANG KREDIT',
      },
      { field: 'coaproses', value: data.coaproses, name: 'COA PROSES' },
    ];

    for (let i = 0; i < coaValues.length; i++) {
      for (let j = i + 1; j < coaValues.length; j++) {
        const first = coaValues[i];
        const second = coaValues[j];

        if (
          first.value != null &&
          second.value != null &&
          first.value === second.value
        ) {
          ctx.addIssue({
            path: [second.field as keyof typeof data],
            code: z.ZodIssueCode.custom,
            message: `${first.name} dan ${second.name} tidak boleh sama`,
          });
        }
      }
    }
    // Validasi khusus penambahan create dapat disimpan di sini
  });
export type CreatePengeluaranEmklDto = z.infer<
  typeof CreatePengeluaranEmklSchema
>;

// ------------------------
// 3. KHUSUS UPDATE
// ------------------------
export const UpdatePengeluaranEmklSchema = z
  .object({
    ...baseFields,
    id: z.number({ required_error: 'Id wajib diisi untuk update' }),
    // Field atau aturan khusus update bisa ditambah di sini
  })
  .superRefine(async (data, ctx) => {
    // Exclude diri sendiri dari pengecekan unik
    const existsName = await isRecordExist(
      'nama',
      data.nama,
      'pengeluaranemkl',
      data.id,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Pengeluaran EMKL dengan nama ini sudah ada',
      });
    }

    const coaValues = [
      { field: 'coadebet', value: data.coadebet, name: 'COA DEBET' },
      { field: 'coakredit', value: data.coakredit, name: 'COA KREDIT' },
      {
        field: 'coapostingkasbankdebet',
        value: data.coapostingkasbankdebet,
        name: 'COA POSTING KASBANK DEBET',
      },
      {
        field: 'coapostingkasbankkredit',
        value: data.coapostingkasbankkredit,
        name: 'COA POSTING KASBANK KREDIT',
      },
      {
        field: 'coapostinghutangdebet',
        value: data.coapostinghutangdebet,
        name: 'COA POSTING HUTANG DEBET',
      },
      {
        field: 'coapostinghutangkredit',
        value: data.coapostinghutangkredit,
        name: 'COA POSTING HUTANG KREDIT',
      },
      { field: 'coaproses', value: data.coaproses, name: 'COA PROSES' },
    ];

    for (let i = 0; i < coaValues.length; i++) {
      for (let j = i + 1; j < coaValues.length; j++) {
        const first = coaValues[i];
        const second = coaValues[j];

        if (
          first.value != null &&
          second.value != null &&
          first.value === second.value
        ) {
          ctx.addIssue({
            path: [second.field as keyof typeof data],
            code: z.ZodIssueCode.custom,
            message: `${first.name} dan ${second.name} tidak boleh sama`,
          });
        }
      }
    }
    // Validasi khusus update bisa diletakkan di sini
  });
export type UpdatePengeluaranEmklDto = z.infer<
  typeof UpdatePengeluaranEmklSchema
>;
