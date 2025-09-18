import { z } from 'zod';

export const UpdateJenissealSchema = z.object({
  nama: z.string(),
  keterangan: z.string(),
  statusaktif: z
    .number()
    .int({ message: 'statusaktif must be an integer' })
    .min(0, { message: 'statusaktif must be a non-negative integer' }),
  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type UpdateJenissealDto = z.infer<typeof UpdateJenissealSchema>;
