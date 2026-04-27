import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

export const CreateGroupbiayaextraSchema = z.object({
  keterangan: z
    .string()
    .min(1, { message: 'keterangan Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await isRecordExist(
          'keterangan',
          value,
          'groupbiayaextra',
        );
        return !exists; // Validasi jika keterangan sudah ada
      },
      {
        message: 'Group Biaya Extra dengan Keterangan ini sudah ada',
      },
    ),
  statusaktif: z
    .number()
    .int({ message: 'statusaktif must be an integer' })
    .min(0, { message: 'statusaktif must be a non-negative integer' }),
  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type CreateGroupbiayaextraDto = z.infer<
  typeof CreateGroupbiayaextraSchema
>;
