import { PartialType } from '@nestjs/mapped-types';
import { CreateLaporantujuankapalDto } from './create-laporantujuankapal.dto';

export class UpdateLaporantujuankapalDto extends PartialType(
  CreateLaporantujuankapalDto,
) {}
