import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

export const CreateComoditySchema = z.object({
  keterangan: z
    .string()
    .min(1, { message: 'keterangan Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await isRecordExist('keterangan', value, 'comodity');
        return !exists; // Validasi jika keterangan sudah ada
      },
      {
        message: 'Keterangan ini sudah ada',
      },
    ),
  rate: z.string().min(1, { message: 'Rate is required' }),
  statusaktif: z
    .number()
    .int({ message: 'statusaktif must be an integer' })
    .min(0, { message: 'statusaktif must be a non-negative integer' }),
  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type CreateComodityDto = z.infer<typeof CreateComoditySchema>;
