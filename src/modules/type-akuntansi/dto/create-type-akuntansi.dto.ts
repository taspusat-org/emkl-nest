import { dbMssql } from 'src/common/utils/db';
import { isRecordExist } from 'src/utils/utils.service';
import { z } from 'zod';

// Fungsi untuk mengecek apakah nama sudah ada di tabel 'typeakuntansi'
const checkIfExistsNama = async (nama: string) => {
  const result = await dbMssql
    .select('*')
    .from('typeakuntansi')
    .where('nama', nama)
    .first();

  return result ? true : false; // Return true jika ada, false jika tidak ada
};

// Fungsi untuk mengecek apakah statusnya aktif
const checkIfActiveStatus = async () => {
  const result = await dbMssql
    .select('statusaktif')
    .from('typeakuntansi')
    .where('statusaktif', 2) // Asumsi status aktif adalah 1
    .first();

  // Pastikan statusnya 1 (aktif)
  return result && result.statusaktif === 1; // Kembalikan true jika aktif, false jika tidak aktif
};

// Zod Schema untuk validasi
export const CreateTypeAkuntansiSchema = z.object({
  nama: z
    .string()
    .min(1, { message: 'Nama Wajib Diisi' })
    .max(100)
    .refine(
      async (value) => {
        const exists = await checkIfExistsNama(value);
        return !exists; // Validasi jika nama sudah ada
      },
      {
        message: 'Type Akuntansi dengan nama ini sudah ada',
      },
    )
    .refine(
      async (value) => {
        const isActive = await checkIfActiveStatus();
        console.log('isActive:', isActive);
        return isActive; // Validasi jika status aktif
      },
      {
        message: 'Type Akuntansi dengan nama ini harus aktif',
      },
    ),

  order: z.number().int({ message: 'Order must be an integer' }),

  keterangan: z.string().min(1, { message: 'Keterangan Wajib Diisi' }).max(100),

  akuntansi_id: z
    .number()
    .int({ message: 'akuntansi_id must be an integer' })
    .min(1, { message: 'Akuntansi Id Wajib Diisi ' })
    .refine(
      async (value) =>
        !(await isRecordExist('akuntansi_id', String(value), 'typeakuntansi')), // Mengecek apakah `akuntansi_id` ada di tabel 'akuntansi'
      {
        message: 'Akuntansi ID sudah ada',
      },
    ),

  statusaktif: z
    .number()
    .int({ message: 'Status Aktif must be an integer' })
    .min(1, { message: 'Status Aktif Wajib Diisi' }),

  modifiedby: z.string().max(200).optional(),
});

export type CreateTypeAkuntansiDto = z.infer<typeof CreateTypeAkuntansiSchema>;
