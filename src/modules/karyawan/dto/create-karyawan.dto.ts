import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

const baseFields = {
  nama: z
    .string()
    .trim()
    .min(1, { message: 'Nama Karyawan Wajib Diisi' })
    .max(255),
  kodeabsen: z.string().trim().nullable().optional(),
  absen_id: z.number().int({ message: 'ID Absen Wajib Diisi' }),
  karyawan_id: z.number().int({ message: 'Karyawan Wajib Diisi' }),
  jabatan_id: z.number().int({ message: 'Jabatan Wajib Diisi' }),
  keterangan: z.string().trim().nullable().optional(),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif Wajib Angka' })
    .nonnegative({ message: 'Status Aktif Tidak Boleh Angka Negatif' }), // Ensure non-negative
  modifiedby: z.string().nullable().optional(),
};

export const createKaryawanSchema = z
  .object({
    ...baseFields,
  })
  .superRefine(async (data, ctx) => {
    // Cek unik hanya untuk create (excludeId tidak ada)
    const existsName = await isRecordExist(
      'karyawan_id',
      data.karyawan_id,
      'karyawan',
    );
    if (existsName) {
      ctx.addIssue({
        path: ['karyawan_nama'],
        code: 'custom',
        message: 'Karyawan dengan nama dari hr ini sudah ada',
      });
    }
    // Validasi khusus penambahan create dapat disimpan di sini
  });
export type CreateKaryawanDto = z.infer<typeof createKaryawanSchema>;

export const updateKaryawanSchema = z
  .object({
    ...baseFields,
    id: z.number({ required_error: 'Id wajib diisi untuk update' }),
  })
  .superRefine(async (data, ctx) => {
    // Cek unik hanya untuk create (excludeId tidak ada)
    const existsName = await isRecordExist(
      'karyawan_id',
      data.karyawan_id,
      'karyawan',
      data.id,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['karyawan_nama'],
        code: 'custom',
        message: 'Karyawan dengan nama dari hr ini sudah ada',
      });
    }
    // Validasi khusus penambahan create dapat disimpan di sini
  });
export type UpdateKaryawanDto = z.infer<typeof updateKaryawanSchema>;
