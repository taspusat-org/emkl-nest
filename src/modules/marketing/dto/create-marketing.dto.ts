import { z } from 'zod'

export const CreateMarketingSchema = z.object({
  nama: z.string().min(1, { message: 'Nama Wajib Diisi' }),
  keterangan: z.string().nullable(),
  statusaktif: z.number().nullable(),
  statusaktif_nama: z.string().nullable().optional(),
  email: z.string().nullable(),
  // karyawa_id: z.number().min()
  // karyawan_id: z.number().min(1, { message: dynamicRequiredMessage('KARYAWAN') }),
  karyawan_nama: z.string().nullable().optional(),
  tglmasuk: z.string().nullable(),
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
})

export type CreateMarketingDto = z.infer<typeof CreateMarketingSchema>;
