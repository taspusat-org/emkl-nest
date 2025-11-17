import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

export const UpdateBiayaSchema = z
  .object({
    id: z.number().optional(),
    nama: z.string().trim().min(1, { message: 'NAMA is required' }),

    keterangan: z.string().trim().min(1, { message: 'KETERANGAN is required' }),

    coa: z.string().nullable().optional(),
    keterangancoa: z.string().nullable().optional(),

    coahut: z.string().nullable().optional(),
    keterangancoahut: z.string().nullable().optional(),

    jenisorderan_id: z.number().optional().nullable(),
    jenisorderan_text: z.string().nullable().optional(),

    statusaktif: z.number().min(1, { message: 'STATUSAKTIF is required' }),
    text: z.string().nullable().optional(),

    info: z.string().nullable().optional(),
    modifiedby: z.string().nullable().optional(),
  })

  .superRefine(async (data, ctx) => {
    const coaValue = data.coa;
    const coahutValue = data.coahut;

    if (coaValue != null && coahutValue != null) {
      if (coaValue === coahutValue) {
        ctx.addIssue({
          path: ['coahut'],
          code: z.ZodIssueCode.custom,
          message: 'COA dan COA Hutang tidak boleh sama',
        });
      }
    }
  })
  .superRefine(async (data, ctx) => {
    const existsName = await isRecordExist(
      'nama',
      data.nama,
      'biaya',
      data.id ?? undefined,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Biaya dengan nama ini sudah ada',
      });
    }
  });

export type UpdateBiayaDto = z.infer<typeof UpdateBiayaSchema>;
