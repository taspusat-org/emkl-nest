import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';

export const UpdateAkuntansiSchema = z
  .object({
    id: z.number().optional(),
    nama: z.string(),
    keterangan: z.string(),
    statusaktif: z
      .number()
      .int({ message: 'statusaktif must be an integer' })
      .min(0, { message: 'statusaktif must be a non-negative integer' }),
    info: z.string().nullable().optional(),
    modifiedby: z.string().nullable().optional(),
  })
  .superRefine(async (data, ctx) => {
    const existsName = await isRecordExist(
      'nama',
      data.nama,
      'akuntansi',
      data.id ?? undefined,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Akuntansi dengan nama ini sudah ada',
      });
    }
  });

export type UpdateAkuntansiDto = z.infer<typeof UpdateAkuntansiSchema>;
