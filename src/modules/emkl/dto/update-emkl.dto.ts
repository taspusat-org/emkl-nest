import { PartialType } from '@nestjs/mapped-types';
import { CreateEmklDto } from './create-emkl.dto';

export class UpdateEmklDto extends PartialType(CreateEmklDto) {}
