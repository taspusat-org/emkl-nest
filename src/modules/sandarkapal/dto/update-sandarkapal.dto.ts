import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

export const UpdateSandarkapalSchema = z
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
      'sandarkapal',
      data.id ?? undefined,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Sandar Kapal dengan nama ini sudah ada',
      });
    }
  });

export type UpdateSandarkapalDto = z.infer<typeof UpdateSandarkapalSchema>;
