import { PartialType } from '@nestjs/mapped-types';
import { CreateAlatbayarDto } from './create-alatbayar.dto';

export class UpdateAlatbayarDto extends PartialType(CreateAlatbayarDto) {}
