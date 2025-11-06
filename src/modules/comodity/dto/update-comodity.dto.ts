import { z } from 'zod';

export const UpdateComoditySchema = z.object({
  keterangan: z.string().min(1, { message: 'Keterangan is required' }),
  rate: z.string().min(1, { message: 'Rate is required' }),
  statusaktif: z
    .number()
    .int({ message: 'statusaktif must be an integer' })
    .min(0, { message: 'statusaktif must be a non-negative integer' }),
  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type UpdateComodityDto = z.infer<typeof UpdateComoditySchema>;
