import { z } from 'zod';

export const CreateHargatruckingSchema = z.object({
  tujuankapal_id: z.number().min(1, { message: 'TUJUAN KAPAL ID is required' }),
  tujuankapal_text: z.string().nullable().optional(),

  emkl_id: z.number().min(1, { message: 'emkl id is required' }),
  emkl_text: z.string().nullable().optional(),

  keterangan: z.string().trim().min(1, { message: 'KETERANGAN is required' }),

  container_id: z.number().min(1, { message: 'Container id is required' }),
  container_text: z.string().nullable().optional(),

  jenisorderan_id: z.number().min(1, { message: 'Jenis Orderan is required' }),
  jenisorderan_text: z.string().nullable().optional(),

  nominal: z.string().min(1, { message: 'Nominal is required' }),

  statusaktif: z.number().min(1, { message: 'status aktif is required' }),
  text: z.string().nullable().optional(),

  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type CreateHargatruckingDto = z.infer<typeof CreateHargatruckingSchema>;
