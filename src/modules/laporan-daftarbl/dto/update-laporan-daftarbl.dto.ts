import { PartialType } from '@nestjs/mapped-types';
import { CreateLaporanDaftarblDto } from './create-laporan-daftarbl.dto';

export class UpdateLaporanDaftarblDto extends PartialType(
  CreateLaporanDaftarblDto,
) {}
