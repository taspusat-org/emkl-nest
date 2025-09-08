import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';

export const CreateBiayaSchema = z
  .object({
    nama: z
      .string()
      .min(1, { message: 'Nama Wajib Diisi' })
      .max(100)
      .refine(
        async (value) => {
          const exists = await isRecordExist('nama', value, 'biaya');
          return !exists; // Validasi jika nama sudah ada
        },
        {
          message: 'Biaya dengan dengan nama ini sudah ada',
        },
      ),

    keterangan: z.string().trim().min(1, { message: 'KETERANGAN is required' }),

    coa: z.string().nullable().optional(),
    keterangancoa: z.string().nullable().optional(),

    coahut: z.string().nullable().optional(),
    keterangancoahut: z.string().nullable().optional(),

    jenisorderan_id: z
      .number()
      .min(1, { message: 'JENIS ORDERAN is required' }),
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
  });

export type CreateBiayaDto = z.infer<typeof CreateBiayaSchema>;
