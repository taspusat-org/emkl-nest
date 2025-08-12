import { z } from 'zod';

export const UpdateJenisOrderanSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(1, { message: 'Jenis Orderan Wajib Diisi' })
    .max(255),
  keterangan: z.string().trim().min(1, { message: 'Keterangan Wajib Diisi' }),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif Wajib Angka' })
    .nonnegative({ message: 'Status Aktif Tidak Boleh Angka Negatif' }), // Ensure non-negative
  modifiedby: z.string().nullable().optional(),
});
export type UpdateJenisOrderanDto = z.infer<typeof UpdateJenisOrderanSchema>;
