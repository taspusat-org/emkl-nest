import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';
export const CreateAlatbayarSchema = z.object({
  nama: z
    .string()
    .min(1, { message: 'Nama Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await isRecordExist('nama', value, 'alatbayar');
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'Alat Bayar dengan dengan nama ini sudah ada',
      },
    ),
  keterangan: z.string().trim().min(1, { message: 'KETERANGAN is required' }),

  statuslangsungcair: z
    .number()
    .min(1, { message: 'Status Langsung Cair is required' }),
  statuslangsungcair_text: z.string().nullable().optional(),

  statusdefault: z.number().min(1, { message: 'emkl id is required' }),
  textdefault: z.string().nullable().optional(),

  statusbank: z.number().min(1, { message: 'Container id is required' }),
  textbank: z.string().nullable().optional(),

  statusaktif: z.number().min(1, { message: 'Jenis Orderan is required' }),
  text: z.string().nullable().optional(),

  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type CreateAlatbayarDto = z.infer<typeof CreateAlatbayarSchema>;
