import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

export const CreateMarketingSchema = z.object({
  nama: z
  .string()
  .nonempty({message: 'Nama waji diisi'})
  .refine(
    async (value) => {
      const exists = await isRecordExist('nama', value, 'marketing');
      return !exists; // Validasi jika nama sudah ada
    },
    {
      message: `Marketing dengan dengan nama ini sudah ada`,
    },
  ),
  keterangan: z.string().nonempty({message: 'Keterangan Wajib Diisi'}),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif Wajib Diisi' })
    .min(1, { message: 'Status Aktif Wajib Diisi' }),
  statusaktif_nama: z.string().nullable().optional(),
  email: z
  .string()
  .nonempty({message: 'Email wajib diisi'})
  .email({ message: 'email must be a valid email address' }),
  karyawan_id: z.number().min(1, { message: "Karyawan Wajib Diisi"}),
  karyawan_nama: z.string().nullable().optional(),
  tglmasuk: z
  .string({
    required_error: 'Tgl Masuk Wajib Diisi',
    invalid_type_error: 'Tgl Masuk Wajib Diisi'
  })
  .nonempty({message: "Tgl Masuk Wajib Diisi"}),
  statustarget: z.number().nullable(),
  statustarget_nama: z.string().nullable().optional(),
  statusbagifee: z.number().nullable(),
  statusbagifee_nama: z.string().nullable().optional(),
  statusfeemanager: z.number().nullable(),
  statusfeemanager_nama: z.string().nullable().optional(),
  marketinggroup_id: z.number().nullable(),
  marketinggroup_nama: z.string().nullable().optional(),
  statusprafee: z.number().nullable(),
  statusprafee_nama: z.string().nullable().optional(),
  modifiedby: z.string().nullable().optional(), 
});

export type CreateMarketingDto = z.infer<typeof CreateMarketingSchema>;
