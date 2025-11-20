import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

export const UpdateGroupbiayaextraSchema = z
  .object({
    id: z.number().optional(),
    keterangan: z.string().min(1, { message: 'Keterangan is required' }),
    statusaktif: z
      .number()
      .int({ message: 'statusaktif must be an integer' })
      .min(0, { message: 'statusaktif must be a non-negative integer' }),
    info: z.string().nullable().optional(),
    modifiedby: z.string().nullable().optional(),
  })
  .superRefine(async (data, ctx) => {
    const existsName = await isRecordExist(
      'keterangan',
      data.keterangan,
      'groupbiayaextra',
      data.id ?? undefined,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['keterangan'],
        code: 'custom',
        message: 'Group Biaya Extra dengan Keterangan ini sudah ada',
      });
    }
  });

export type UpdateGroupbiayaextraDto = z.infer<
  typeof UpdateGroupbiayaextraSchema
>;
