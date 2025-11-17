import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

export const UpdateBankSchema = z
  .object({
    id: z.number().optional(),
    nama: z.string().trim().min(1, { message: 'NAMA is required' }),

    keterangan: z.string().trim().min(1, { message: 'KETERANGAN is required' }),

    coa: z.string().nullable().optional(),
    keterangancoa: z.string().nullable().optional(),

    coagantung: z.string().nullable().optional(),
    keterangancoagantung: z.string().nullable().optional(),

    statusbank: z.number().min(1, { message: 'STATUSBANK is required' }),
    textbank: z.string().nullable().optional(),

    statusaktif: z.number().min(1, { message: 'STATUSAKTIF is required' }),
    text: z.string().nullable().optional(),

    statusdefault: z.number().min(1, { message: 'STATUSDEFAULT is required' }),
    textdefault: z.string().nullable().optional(),

    formatpenerimaan: z
      .number()
      .min(1, { message: 'FORMATPENERIMAAN is required' }),
    formatpenerimaantext: z.string().nullable().optional(),

    formatpengeluaran: z
      .number()
      .min(1, { message: 'FORMATPENGELUARAN is required' }),
    formatpengeluarantext: z.string().nullable().optional(),

    formatpenerimaangantung: z
      .number()
      .min(1, { message: 'FORMATPENERIMAANGANTUNG is required' }),
    formatpenerimaangantungtext: z.string().nullable().optional(),

    formatpengeluarangantung: z
      .number()
      .min(1, { message: 'FORMATPENGELUARANGANTUNG is required' }),
    formatpengeluarangantungtext: z.string().nullable().optional(),

    formatpencairan: z
      .number()
      .min(1, { message: 'FORMATPENCAIRAN is required' }),
    formatpencairantext: z.string().nullable().optional(),

    formatrekappenerimaan: z
      .number()
      .min(1, { message: 'FORMATREKAPPENERIMAAN is required' }),
    formatrekappenerimaantext: z.string().nullable().optional(),

    formatrekappengeluaran: z
      .number()
      .min(1, { message: 'FORMATREKAPPENGELUARAN is required' }),
    formatrekappengeluarantext: z.string().nullable().optional(),

    info: z.string().nullable().optional(),
    modifiedby: z.string().nullable().optional(),
  })
  .superRefine(async (data, ctx) => {
    const coaValue = data.coa;
    const coaGantungValue = data.coagantung;

    if (coaValue != null && coaGantungValue != null) {
      if (coaValue === coaGantungValue) {
        ctx.addIssue({
          path: ['coagantung'],
          code: z.ZodIssueCode.custom,
          message: 'COA dan COA Gantung tidak boleh sama',
        });
      }
    }
  })
  .superRefine(async (data, ctx) => {
    const existsName = await isRecordExist(
      'nama',
      data.nama,
      'bank',
      data.id ?? undefined,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Bank dengan nama ini sudah ada',
      });
    }
  });

export type UpdateBankDto = z.infer<typeof UpdateBankSchema>;
