import { z } from 'zod';

export const UpdateKapalSchema = z.object({
  nama: z.string(),
  keterangan: z.string(),
  statusaktif: z
    .number()
    .int({ message: 'statusaktif must be an integer' })
    .min(0, { message: 'statusaktif must be a non-negative integer' }),
  pelayaran_id: z
    .number()
    .int({ message: 'pelayaran_id must be an integer' })
    .min(0, { message: 'pelayaran_id must be a non-negative integer' }),
  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type UpdateKapalDto = z.infer<typeof UpdateKapalSchema>;
