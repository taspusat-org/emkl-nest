import { dbMssql } from 'src/common/utils/db';
import { z } from 'zod';
const checkIfExistsNama = async (nama: string) => {
  const result = await dbMssql
    .select('*')
    .from('jenisbiayamarketing')
    .where('nama', nama)
    .first();

  return result ? true : false; // Return true jika ada, false jika tidak ada
};

export const CreateJenisbiayamarketingSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(1, { message: 'Nama Jenis Biaya Marketing Wajib Diisi' })
    .max(255)
    .refine(
      async (value) => {
        console.log('value', value);
        const exists = await checkIfExistsNama(value);
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'Jenis Biaya Marketing dengan nama ini sudah ada',
      },
    ),
  keterangan: z.string().trim().nullable().optional(),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif Wajib Angka' })
    .nonnegative({ message: 'Status Aktif Tidak Boleh Angka Negatif' }), // Ensure non-negative
  modifiedby: z.string().nullable().optional(),
});
export type CreateJenisbiayamarketingDto = z.infer<
  typeof CreateJenisbiayamarketingSchema
>;
