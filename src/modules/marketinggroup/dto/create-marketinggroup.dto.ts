import { dbMssql } from 'src/common/utils/db';
import { z } from 'zod';
const checkIfExistsNama = async (marketing_id: number) => {
  const result = await dbMssql
    .select('*')
    .from('marketinggroup')
    .where('marketing_id', marketing_id)
    .first();
  console.log(result);
  return result ? true : false; // Return true jika ada, false jika tidak ada
};

export const CreateMarketinggroupSchema = z.object({
  marketing_id: z
    .number()
    .int({ message: 'Marketing Wajib Diisi' })
    .refine(
      async (value) => {
        console.log('value', value);
        const exists = await checkIfExistsNama(value);
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'Marketing dengan nama ini sudah dibuat group',
      },
    ),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif Wajib Angka' })
    .nonnegative({ message: 'Status Aktif Tidak Boleh Angka Negatif' }), // Ensure non-negative
  modifiedby: z.string().nullable().optional(),
});
export type CreateMarketinggroupDto = z.infer<
  typeof CreateMarketinggroupSchema
>;
