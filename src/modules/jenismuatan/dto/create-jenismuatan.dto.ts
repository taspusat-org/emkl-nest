import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';
export const CreateJenisMuatanSchema = z.object({
  nama: z
    .string()
    .min(1, { message: 'Nama Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await isRecordExist('nama', value, 'jenismuatan');
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'Container dengan dengan nama ini sudah ada',
      },
    ),
  keterangan: z.string().trim().min(1, { message: 'Keterangan Wajib Diisi' }),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif Wajib Angka' })
    .nonnegative({ message: 'Status Aktif Tidak Boleh Angka Negatif' }), // Ensure non-negative
  modifiedby: z.string().nullable().optional(),
});
export type CreateJenisMuatanDto = z.infer<typeof CreateJenisMuatanSchema>;
