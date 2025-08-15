import { PartialType } from '@nestjs/mapped-types';
import { CreateLaporanbankDto } from './create-laporanbank.dto';

export class UpdateLaporanbankDto extends PartialType(CreateLaporanbankDto) {}
