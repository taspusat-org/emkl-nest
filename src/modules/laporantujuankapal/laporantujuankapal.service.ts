import { Injectable } from '@nestjs/common';
import { CreateLaporantujuankapalDto } from './dto/create-laporantujuankapal.dto';
import { UpdateLaporantujuankapalDto } from './dto/update-laporantujuankapal.dto';

@Injectable()
export class LaporantujuankapalService {
  create(createLaporantujuankapalDto: CreateLaporantujuankapalDto) {
    return 'This action adds a new laporantujuankapal';
  }

  findAll() {
    return `This action returns all laporantujuankapal`;
  }

  findOne(id: number) {
    return `This action returns a #${id} laporantujuankapal`;
  }

  update(id: number, updateLaporantujuankapalDto: UpdateLaporantujuankapalDto) {
    return `This action updates a #${id} laporantujuankapal`;
  }

  remove(id: number) {
    return `This action removes a #${id} laporantujuankapal`;
  }
}
