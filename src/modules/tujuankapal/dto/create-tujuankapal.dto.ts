import { z } from 'zod';

export const CreateTujuankapalSchema = z.object({
  nama: z.string(),
  keterangan: z.string(),
  cabang_id: z
    .number()
    .int({ message: 'statusaktif must be an integer' })
    .min(0, { message: 'statusaktif must be a non-negative integer' }),
  statusaktif: z
    .number()
    .int({ message: 'statusaktif must be an integer' })
    .min(0, { message: 'statusaktif must be a non-negative integer' }),
  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type CreateTujuankapalDto = z.infer<typeof CreateTujuankapalSchema>;
