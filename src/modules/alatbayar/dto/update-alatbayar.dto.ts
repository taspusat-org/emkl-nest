import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

export const UpdateAlatbayarSchema = z
  .object({
    id: z.number().optional(),
    nama: z.string().min(1, { message: 'NAMA is required' }),
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
  })
  .superRefine(async (data, ctx) => {
    const existsName = await isRecordExist(
      'nama',
      data.nama,
      'alatbayar',
      data.id ?? undefined,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Alat Bayar dengan nama ini sudah ada',
      });
    }
  });

export type UpdateAlatbayarDto = z.infer<typeof UpdateAlatbayarSchema>;
