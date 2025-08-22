import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';
export const CreateTujuankapalSchema = z.object({
  nama: z
    .string()
    .min(1, { message: 'Nama Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await isRecordExist('nama', value, 'tujuankapal');
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'Tujuan kapal dengan dengan nama ini sudah ada',
      },
    ),
  keterangan: z.string(),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif must be an integer' })
    .min(1, { message: 'Status Aktif Wajib Diisi' }),
  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type CreateTujuankapalDto = z.infer<typeof CreateTujuankapalSchema>;
