import { z } from 'zod';

export const UpdateSandarkapalSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(1, { message: 'Nama Sandar kapal Wajib Diisi' })
    .max(255),
  keterangan: z.string().trim().nullable().optional(),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif Wajib Angka' })
    .nonnegative({ message: 'Status Aktif Tidak Boleh Angka Negatif' }), // Ensure non-negative
  modifiedby: z.string().nullable().optional(),
});
export type UpdateSandarkapalDto = z.infer<typeof UpdateSandarkapalSchema>;
