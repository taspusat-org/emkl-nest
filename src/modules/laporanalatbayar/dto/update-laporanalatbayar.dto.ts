import { PartialType } from '@nestjs/mapped-types';
import { CreateLaporanalatbayarDto } from './create-laporanalatbayar.dto';

export class UpdateLaporanalatbayarDto extends PartialType(
  CreateLaporanalatbayarDto,
) {}
