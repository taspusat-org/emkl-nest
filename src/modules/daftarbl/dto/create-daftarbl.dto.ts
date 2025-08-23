import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';
export const CreateDaftarblSchema = z.object({
  nama: z
    .string()
    .min(1, { message: 'Nama Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await isRecordExist('nama', value, 'daftarbl');
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'daftar bl dengan dengan nama ini sudah ada',
      },
    ),
  keterangan: z.string(),
  statusaktif: z
    .number()
    .int({ message: 'statusaktif must be an integer' })
    .min(0, { message: 'statusaktif must be a non-negative integer' }),
  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type CreateDaftarblDto = z.infer<typeof CreateDaftarblSchema>;
