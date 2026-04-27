import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';

export const CreateCabangSchema = z.object({
  kodecabang: z
    .string()
    .min(1, { message: 'Kode Cabang Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await isRecordExist('kodecabang', value, 'cabang');
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'Kode Cabang dengan dengan kode ini sudah ada',
      },
    ),

  nama: z
    .string()
    .min(1, { message: 'Nama Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await isRecordExist('nama', value, 'cabang');
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'Cabang dengan dengan nama ini sudah ada',
      },
    ),

  statusaktif: z
    .number()
    .int({ message: 'statusaktif must be an integer' })
    .nonnegative({ message: 'statusaktif must be a non-negative integer' }), // Ensure non-negative
  modifiedby: z.string().nullable().optional(),
  cabang_id: z
    .number()
    .int({ message: 'periode must be an integer' })
    .nonnegative({ message: 'periode must be a non-negative integer' }), // Ensure non-negative
});

export type CreateCabangDto = z.infer<typeof CreateCabangSchema>;
