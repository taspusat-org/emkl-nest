import { PartialType } from '@nestjs/mapped-types';
import { CreateAkunpusatDto } from './create-akunpusat.dto';

export class UpdateAkunpusatDto extends PartialType(CreateAkunpusatDto) {}
