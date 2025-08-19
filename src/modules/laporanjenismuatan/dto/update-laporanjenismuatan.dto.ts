import { PartialType } from '@nestjs/mapped-types';
import { CreateLaporanjenismuatanDto } from './create-laporanjenismuatan.dto';

export class UpdateLaporanjenismuatanDto extends PartialType(
  CreateLaporanjenismuatanDto,
) {}
