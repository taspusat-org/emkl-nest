import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

export const UpdateJenisMuatanSchema = z
  .object({
    id: z.number().optional(),
    nama: z
      .string()
      .trim()
      .min(1, { message: 'Jenis Muatan Wajib Diisi' })
      .max(255),
    keterangan: z.string().trim().min(1, { message: 'Keterangan Wajib Diisi' }),
    statusaktif: z
      .number()
      .int({ message: 'Status Aktif Wajib Angka' })
      .nonnegative({ message: 'Status Aktif Tidak Boleh Angka Negatif' }), // Ensure non-negative
    modifiedby: z.string().nullable().optional(),
  })
  .superRefine(async (data, ctx) => {
    const existsName = await isRecordExist(
      'nama',
      data.nama,
      'jenismuatan',
      data.id ?? undefined,
    );
    if (existsName) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Jenis Muatan dengan nama ini sudah ada',
      });
    }
  });
export type UpdateJenisMuatanDto = z.infer<typeof UpdateJenisMuatanSchema>;
