import { z } from 'zod';
import { isRecordExist } from 'src/utils/utils.service';

// ------------------------
// 1. BASE FIELDS
// ------------------------
const baseFields = {
  nobukti: z.string().nullable(),

  tglbukti: z
    .string({ message: 'TGL BUKTI WAJIB DIISI' })
    .nonempty({ message: 'TGL BUKTI WAJIB DIISI' }),

  jenisorder_id: z
    .number()
    .int({ message: 'BANK DARI' })
    .min(1, { message: 'BANK DARI' }),
  jenisorder_nama: z.string().nullable().optional(),

  // modifiedby diisi di backend, optional di request body
  modifiedby: z.string().max(200).optional(),
};


// ------------------------
// 2. KHUSUS CREATE
// ------------------------
export const CreateBookingOrderanHeaderSchema = z
  .object({
    ...baseFields,
    // Field/aturan khusus create bisa ditambah di sini
  })
  .superRefine(async (data, ctx) => {
    // Validasi khusus penambahan create dapat disimpan di sini
  });
export type CreateBookingOrderanHeaderDto = z.infer<typeof CreateBookingOrderanHeaderSchema>;


// ------------------------
// 3. KHUSUS UPDATE
// ------------------------
export const UpdateBookingOrderanHeaderSchema = z
  .object({
    ...baseFields,
    // id: z.number({ required_error: 'Id wajib diisi untuk update' }),
    // Field atau aturan khusus update bisa ditambah di sini
  })
  .superRefine(async (data, ctx) => {
  });
export type UpdateBookingOrderanHeaderDto = z.infer<typeof UpdateBookingOrderanHeaderSchema>;
