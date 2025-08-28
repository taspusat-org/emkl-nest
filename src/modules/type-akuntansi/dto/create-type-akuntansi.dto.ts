import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';
// ------------------------
// 1. BASE FIELDS
// ------------------------
const baseFields = {
  nama: z.string().min(1, { message: 'Nama Wajib Diisi' }).max(100),
  order: z.number().int({ message: 'Order harus bilangan bulat' }),
  keterangan: z.string().min(1, { message: 'Keterangan Wajib Diisi' }).max(100),
  akuntansi_id: z
    .number()
    .int({ message: 'akuntansi_id harus bil bulat' })
    .min(1, { message: 'Akuntansi Id Wajib Diisi' }),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif harus bulat' })
    .min(1, { message: 'Status Aktif Wajib Diisi' }),
  // modifiedby diisi di backend, optional di request body
  modifiedby: z.string().max(200).optional(),
};
// ------------------------
// 2. KHUSUS CREATE
// ------------------------
export const CreateTypeAkuntansiSchema = z
  .object({
    ...baseFields,
    // Field/aturan khusus create bisa ditambah di sini
  })
  .superRefine(async (data, ctx) => {
    // Cek unik hanya untuk create (excludeId tidak ada)
    const existsName = await isRecordExist('nama', data.nama, 'typeakuntansi');
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Type Akuntansi dengan nama ini sudah ada',
      });
    }
    const existsOrder = await isRecordExist(
      'order',
      data.order,
      'typeakuntansi',
    );
    if (existsOrder) {
      ctx.addIssue({
        path: ['order'],
        code: 'custom',
        message: 'Type Akuntansi dengan order ini sudah ada',
      });
    }
    // Validasi khusus penambahan create dapat disimpan di sini
  });
export type CreateTypeAkuntansiDto = z.infer<typeof CreateTypeAkuntansiSchema>;
// ------------------------
// 3. KHUSUS UPDATE
// ------------------------
export const UpdateTypeAkuntansiSchema = z
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
      'typeakuntansi',
      data.id,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Type Akuntansi dengan nama ini sudah ada',
      });
    }
    const existsOrder = await isRecordExist(
      'order',
      data.order,
      'typeakuntansi',
      data.id,
    );
    if (existsOrder) {
      ctx.addIssue({
        path: ['order'],
        code: 'custom',
        message: 'Type Akuntansi dengan order ini sudah ada',
      });
    }
    // Validasi khusus update bisa diletakkan di sini
  });
export type UpdateTypeAkuntansiDto = z.infer<typeof UpdateTypeAkuntansiSchema>;
