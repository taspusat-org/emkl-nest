import { PartialType } from '@nestjs/mapped-types';
import { CreateRelasiDto } from './create-relasi.dto';

export class UpdateRelasiDto extends PartialType(CreateRelasiDto) {}
