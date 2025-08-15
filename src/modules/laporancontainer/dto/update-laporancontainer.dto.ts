import { PartialType } from '@nestjs/mapped-types';
import { CreateLaporancontainerDto } from './create-laporancontainer.dto';

export class UpdateLaporancontainerDto extends PartialType(CreateLaporancontainerDto) {}
