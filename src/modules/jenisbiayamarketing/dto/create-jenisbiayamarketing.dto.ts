import { dbMssql } from 'src/common/utils/db';
import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

const baseFields = {
  nama: z
    .string()
    .trim()
    .min(1, { message: 'Nama Jenis Biaya Marketing Wajib Diisi' })
    .max(255),
  keterangan: z.string().trim().nullable().optional(),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif Wajib Angka' })
    .nonnegative({ message: 'Status Aktif Tidak Boleh Angka Negatif' }), // Ensure non-negative
  modifiedby: z.string().nullable().optional(),
};
export const CreateJenisbiayamarketingSchema = z
  .object({
    ...baseFields,
  })
  .superRefine(async (data, ctx) => {
    // Cek unik hanya untuk create (excludeId tidak ada)
    const existsName = await isRecordExist(
      'nama',
      data.nama,
      'jenisbiayamarketing',
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Jenis Biaya Marketing dengan nama ini sudah ada',
      });
    }
    // Validasi khusus penambahan create dapat disimpan di sini
  });
export type CreateJenisbiayamarketingDto = z.infer<
  typeof CreateJenisbiayamarketingSchema
>;

export const UpdateJenisbiayamarketingSchema = z
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
      'jenisbiayamarketing',
      data.id,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Jenis Biaya Marketing dengan nama ini sudah ada',
      });
    }
    // Validasi khusus update bisa diletakkan di sini
  });
export type UpdateJenisbiayamarketingDto = z.infer<
  typeof UpdateJenisbiayamarketingSchema
>;
