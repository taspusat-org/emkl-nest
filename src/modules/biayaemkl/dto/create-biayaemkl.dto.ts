import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';

export const CreateBiayaemklSchema = z.object({
  nama: z
    .string()
    .min(1, { message: 'Nama Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await isRecordExist('nama', value, 'biayaemkl');
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'Biaya EMKL dengan dengan nama ini sudah ada',
      },
    ),

  keterangan: z.string().trim().min(1, { message: 'KETERANGAN is required' }),

  biaya_id: z.number().min(1, { message: 'JENIS ORDERAN is required' }),
  biaya_text: z.string().nullable().optional(),

  coahut: z.string().nullable().optional(),
  keterangancoahut: z.string().nullable().optional(),

  jenisorderan_id: z.number().min(1, { message: 'JENIS ORDERAN is required' }),
  jenisorderan_text: z.string().nullable().optional(),

  statusaktif: z.number().min(1, { message: 'Status Aktif is required' }),
  text: z.string().nullable().optional(),

  statusbiayabl: z.number().min(1, { message: 'Status Biaya BL is required' }),
  statusbiayabl_text: z.string().nullable().optional(),

  statusseal: z.number().min(1, { message: 'Status Seal is required' }),
  statusseal_text: z.string().nullable().optional(),

  info: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(),
});

export type CreateBiayaemklDto = z.infer<typeof CreateBiayaemklSchema>;
