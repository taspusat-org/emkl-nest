import { PartialType } from '@nestjs/mapped-types';
import { CreateLaporandaftarbankDto } from './create-laporandaftarbank.dto';

export class UpdateLaporandaftarbankDto extends PartialType(
  CreateLaporandaftarbankDto,
) {}
