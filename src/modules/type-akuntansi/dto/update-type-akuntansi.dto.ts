import { z } from 'zod';
import { dbMssql } from 'src/common/utils/db';

const checkIfExistsNama = async (nama: string, id: any) => {
  const result = await dbMssql
    .select('*')
    .from('typeakuntansi')
    .where('nama', nama)
    .where('id', '!=', id)
    .first();

  return result ? true : false; // Return true jika ada, false jika tidak ada
};

const checkIfExistsOrder = async (order: any, id: any) => {
  const result = await dbMssql
    .select('*')
    .from('typeakuntansi')
    .where('order', order)
    .where('id', '!=', id)
    .first();

  return result ? true : false; // Return true jika ada, false jika tidak ada
};

export const UpdateTypeAkuntansiSchema = z
  .object({
    id: z.number().nullable().optional(),
    nama: z.string().min(1, { message: 'Nama Wajib Diisi' }).max(100),
    order: z.number().int({ message: 'Order must be an integer' }),
    keterangan: z
      .string()
      .min(1, { message: 'Keterangan Wajib Diisi' })
      .max(100),
    akuntansi_id: z
      .number()
      .int({ message: 'akuntansi_id must be an integer' })
      .min(1, { message: 'Akuntansi Id Wajib Diisi ' }),
    statusaktif: z
      .number()
      .int({ message: 'Status Aktif must be an integer' })
      .min(1, { message: 'Status Aktif Wajib Diisi' }),
    modifiedby: z.string().max(200).optional(),
  })
  .superRefine(async (data, ctx) => {
    const exists = await checkIfExistsNama(data.nama, data.id);

    if (exists) {
      ctx.addIssue({
        path: ['nama'],
        code: 'custom',
        message: 'Type Akuntansi dengan nama ini sudah ada',
      });
    }

    const exists2 = await checkIfExistsOrder(data.order, data.id);
    if (exists2) {
      ctx.addIssue({
        path: ['order'],
        code: 'custom',
        message: 'Type Akuntansi dengan order ini sudah ada',
      });
    }
  });

export type UpdateTypeAkuntansiDto = z.infer<typeof UpdateTypeAkuntansiSchema>;
