import { z } from 'zod';

export const CreateRelasiSchema = z.object({
  statusrelasi: z
    .number()
    .int({ message: 'Status Relasi Wajib Angka' })
    .nonnegative({ message: 'Status Relasi Tidak Boleh Angka Negatif' }),
  nama: z.string().trim().min(1, { message: 'Nama Wajib Diisi' }),
  coagiro: z.string().nullable().optional(),
  coapiutang: z.string().nullable().optional(),
  coahutang: z.string().nullable().optional(),
  statustitip: z
    .number()
    .int({ message: 'Status Relasi Wajib Angka' })
    .nonnegative({ message: 'Status Relasi Tidak Boleh Angka Negatif' })
    .nullable()
    .optional(),
  titipcabang_id: z
    .number()
    .int({ message: 'Status Relasi Wajib Angka' })
    .nonnegative({ message: 'Status Relasi Tidak Boleh Angka Negatif' })
    .nullable()
    .optional(),
  alamat: z.string().nullable().optional(),
  npwp: z.string().nullable().optional(),
  namapajak: z.string().nullable().optional(),
  alamatpajak: z.string().nullable().optional(),
  statusaktif: z
    .number()
    .int({ message: 'Status Relasi Wajib Angka' })
    .nonnegative({ message: 'Status Relasi Tidak Boleh Angka Negatif' })
    .nullable()
    .optional(),
  modifiedby: z.string().nullable().optional(),
});
export type CreateRelasiDto = z.infer<typeof CreateRelasiSchema>;
