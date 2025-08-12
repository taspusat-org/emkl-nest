import { z } from 'zod';

export const CreateJenisMuatanSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(1, { message: 'Jenis Muatan Wajib Diisi' })
    .max(255),
  keterangan: z.string().trim().min(1, { message: 'Keterangan Wajib Diisi' }),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif Wajib Angka' })
    .nonnegative({ message: 'Status Aktif Tidak Boleh Angka Negatif' }), // Ensure non-negative
  modifiedby: z.string().nullable().optional(),
});
export type CreateJenisMuatanDto = z.infer<typeof CreateJenisMuatanSchema>;
