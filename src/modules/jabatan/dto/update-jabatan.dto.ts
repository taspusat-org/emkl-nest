import { z } from 'zod';

export const UpdateJabatanSchema = z.object({
  nama: z.string(),
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

export type UpdateJabatanDto = z.infer<typeof UpdateJabatanSchema>;
