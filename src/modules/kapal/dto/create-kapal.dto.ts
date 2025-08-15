import { z } from 'zod';

export const CreateKapalSchema = z.object({
  nama: z.string().max(255).optional(), // Nullable field
  keterangan: z.string().max(255).optional(), // Nullable field
  statusaktif: z.number().max(50).optional(), // Nullable field
  pelayaran_id: z.number().max(50).optional(), // Nullable field
  modifiedby: z.string().max(255).optional(), // Nullable field
});

export type CreateKapalDto = z.infer<typeof CreateKapalSchema>;
