import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

export const UpdateJabatanSchema = z
  .object({
    id: z.number().optional(),
    nama: z.string(),
    keterangan: z.string(),
    statusaktif: z
      .number()
      .int({ message: 'statusaktif must be an integer' })
      .min(0, { message: 'statusaktif must be a non-negative integer' }),
    divisi_id: z
      .number()
      .int({ message: 'divisi_id must be an integer' })
      .min(0, { message: 'divisi_id must be a non-negative integer' }),
    info: z.string().nullable().optional(),
    modifiedby: z.string().nullable().optional(),
  })
  .superRefine(async (data, ctx) => {
    const existsName = await isRecordExist(
      'nama',
      data.nama,
      'jabatan',
      data.id ?? undefined,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Jabatan dengan nama ini sudah ada',
      });
    }
  });

export type UpdateJabatanDto = z.infer<typeof UpdateJabatanSchema>;
