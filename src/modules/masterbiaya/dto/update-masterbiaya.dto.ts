import { z } from 'zod';

export const UpdateMasterbiayaSchema = z.object({
  tujuankapal_id: z.number().nullable().optional(),
  tujuankapal_text: z.string().nullable().optional(),

  sandarkapal_id: z.number().nullable().optional(),
  sandarkapal_text: z.string().nullable().optional(),

  pelayaran_id: z.number().nullable().optional(),
  pelayaran_text: z.string().nullable().optional(),

  container_id: z.number().nullable().optional(),
  container_text: z.string().nullable().optional(),

  biayaemkl_id: z.number().nullable().optional(),
  biayaemkl_text: z.string().nullable().optional(),

  jenisorder_id: z.number().optional().nullable(),
  jenisorderan_text: z.string().nullable().optional(),

  tglberlaku: z
    .string()
    .trim()
    .min(1, { message: 'Tanggal Berlaku is required' }),

  nominal: z.string().trim().min(1, { message: 'Nominal is required' }),

  statusaktif: z.number().min(1, { message: 'STATUSAKTIF is required' }),
  text: z.string().nullable().optional(),

  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type UpdateMasterBiayaDto = z.infer<typeof UpdateMasterbiayaSchema>;
