import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

export const UpdateTujuankapalSchema = z
  .object({
    id: z.number().optional(),
    nama: z.string(),
    keterangan: z.string(),
    statusaktif: z
      .number()
      .int({ message: 'Status Aktif must be an integer' })
      .min(1, { message: 'Status Aktif Wajib Diisi' }),
    info: z.string().nullable().optional(),
    modifiedby: z.string().nullable().optional(),
  })
  .superRefine(async (data, ctx) => {
    const existsName = await isRecordExist(
      'nama',
      data.nama,
      'tujuankapal',
      data.id ?? undefined,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Tujuan Kapal dengan nama ini sudah ada',
      });
    }
  });

export type UpdateTujuankapalDto = z.infer<typeof UpdateTujuankapalSchema>;
