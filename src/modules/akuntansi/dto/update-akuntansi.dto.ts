import { z } from 'zod';

export const UpdateAkuntansiSchema = z.object({
  namaakuntansi: z.string().max(255).optional(), // Nullable field
  keterangan: z.string().max(255).optional(), // Nullable field
  statusaktif: z.number().max(50).optional(), // Nullable field
  modifiedby: z.string().max(255).optional(), // Nullable field
  info: z.string().max(255).optional(), // Nullable field
});

export type UpdateAkuntansiDto = z.infer<typeof UpdateAkuntansiSchema>;
