import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';
export const CreateJenisOrderanSchema = z.object({
  nama: z
    .string()
    .min(1, { message: 'Nama Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await isRecordExist('nama', value, 'jenisorderan');
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'Jenis Orderan dengan dengan nama ini sudah ada',
      },
    ),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif Wajib Angka' })
    .nonnegative({ message: 'Status Aktif Tidak Boleh Angka Negatif' }), // Ensure non-negative
  modifiedby: z.string().nullable().optional(),
});
export type CreateJenisOrderanDto = z.infer<typeof CreateJenisOrderanSchema>;
