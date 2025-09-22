import { PartialType } from '@nestjs/mapped-types';
import { CreateTradoDto } from './create-trado.dto';

export class UpdateTradoDto extends PartialType(CreateTradoDto) {}
