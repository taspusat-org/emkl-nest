// import { PartialType } from '@nestjs/mapped-types';
// import { CreateTypeAkuntansiDto } from './create-type-akuntansi.dto';

// export class UpdateTypeAkuntansiDto extends PartialType(CreateTypeAkuntansiDto) {}

import { z } from 'zod';

export const UpdateTypeAkuntansiSchema = z.object({
  nama: z.string().min(1, { message: 'Nama Wajib Diisi' }).max(100),
  order: z.number().int({ message: 'Order must be an integer' }),
  keterangan: z.string().min(1, { message: 'Keterangan Wajib Diisi' }).max(100),
  akuntansi_id: z
    .number()
    .int({ message: 'akuntansi_id must be an integer' })
    .min(1, { message: 'Akuntansi Id Wajib Diisi ' }),
  statusaktif: z
    .number()
    .int({ message: 'Status Aktif must be an integer' })
    .min(1, { message: 'Status Aktif Wajib Diisi' }),
  modifiedby: z.string().max(200).optional(),
});

export type UpdateTypeAkuntansiDto = z.infer<typeof UpdateTypeAkuntansiSchema>;
