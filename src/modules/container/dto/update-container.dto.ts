import { z } from 'zod';

export const UpdateContainerSchema = z.object({
  nama: z.string().nullable(),
  keterangan: z.string().nullable(),
  statusaktif: z
    .number()
    .int({ message: 'statusaktif must be an integer' })
    .min(0, { message: 'statusaktif must be a non-negative integer' })
    .optional(), // Optional
  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type UpdateContainerDto = z.infer<typeof UpdateContainerSchema>;
