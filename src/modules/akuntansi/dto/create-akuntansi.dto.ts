import { z } from 'zod';

export const CreateAkuntansiSchema = z.object({
  namaakuntansi: z.string().max(255).optional(), // Nullable field
  keterangan: z.string().max(255).optional(), // Nullable field
  statusaktif: z.number().max(50).optional(), // Nullable field
  modifiedby: z.string().max(255).optional(), // Nullable field
});

export type CreateAkuntansiDto = z.infer<typeof CreateAkuntansiSchema>;
