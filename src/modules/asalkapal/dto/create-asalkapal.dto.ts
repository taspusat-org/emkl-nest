import { z } from 'zod';

export const CreateAsalKapalSchema = z.object({
  nominal: z.string().max(255).optional(), // Nullable field
  keterangan: z.string().max(255),
  cabang_id: z.number().max(50),
  container_id: z.number().max(50),
  statusaktif: z.number().max(50),
  modifiedby: z.string().max(255).optional(), // Nullable field
});

export type CreateAsalkapalDto = z.infer<typeof CreateAsalKapalSchema>;
