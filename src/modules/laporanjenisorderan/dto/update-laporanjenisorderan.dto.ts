import { PartialType } from '@nestjs/mapped-types';
import { CreateLaporanjenisorderanDto } from './create-laporanjenisorderan.dto';

export class UpdateLaporanjenisorderanDto extends PartialType(
  CreateLaporanjenisorderanDto,
) {}
