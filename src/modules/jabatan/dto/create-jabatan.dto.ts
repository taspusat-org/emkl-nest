import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';
export const CreateJabatanSchema = z.object({
  nama: z
    .string()
    .min(1, { message: 'Nama Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await isRecordExist('nama', value, 'Jabatan');
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'Jabatan dengan dengan nama ini sudah ada',
      },
    ),
  keterangan: z.string(),
  statusaktif: z
    .number()
    .int({ message: 'statusaktif must be an integer' })
    .min(0, { message: 'statusaktif must be a non-negative integer' }),
  divisi_id: z
    .number()
    .int({ message: 'divisi_id must be an integer' })
    .min(0, { message: 'divisi_id must be a non-negative integer' }),
  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type CreateJabatanDto = z.infer<typeof CreateJabatanSchema>;
