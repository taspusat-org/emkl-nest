import { z } from 'zod';

export const UpdateAlatbayarSchema = z.object({
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
});

export type UpdateAlatbayarDto = z.infer<typeof UpdateAlatbayarSchema>;
