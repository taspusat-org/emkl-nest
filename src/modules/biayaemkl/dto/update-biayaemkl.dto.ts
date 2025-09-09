import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';

export const UpdateBiayaemklSchema = z.object({
  nama: z.string().trim().min(1, { message: 'NAMA is required' }),

  keterangan: z.string().trim().min(1, { message: 'KETERANGAN is required' }),

  biaya_id: z.number().min(1, { message: 'JENIS ORDERAN is required' }),
  biaya_text: z.string().nullable().optional(),

  coahut: z.string().trim().min(1, { message: 'Coa Hutang is required' }),
  keterangancoahut: z.string().nullable().optional(),

  jenisorderan_id: z.number().optional().nullable(),
  jenisorderan_text: z.string().nullable().optional(),

  statusaktif: z.number().min(1, { message: 'STATUSAKTIF is required' }),
  text: z.string().nullable().optional(),

  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type UpdateBiayaemklDto = z.infer<typeof UpdateBiayaemklSchema>;
