import { z } from 'zod';

export const UpdateTujuankapalSchema = z.object({
  nama: z.string(),
  keterangan: z.string(),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif must be an integer' })
    .min(1, { message: 'Status Aktif Wajib Diisi' }),
  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type UpdateTujuankapalDto = z.infer<typeof UpdateTujuankapalSchema>;
