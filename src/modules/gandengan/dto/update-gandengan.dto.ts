import { PartialType } from '@nestjs/mapped-types';
import { CreateGandenganDto } from './create-gandengan.dto';

export class UpdateGandenganDto extends PartialType(CreateGandenganDto) {}
