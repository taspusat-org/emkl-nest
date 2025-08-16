import { PartialType } from '@nestjs/mapped-types';
import { CreateLaporanhargatruckingDto } from './create-laporanhargatrucking.dto';

export class UpdateLaporanhargatruckingDto extends PartialType(
  CreateLaporanhargatruckingDto,
) {}
