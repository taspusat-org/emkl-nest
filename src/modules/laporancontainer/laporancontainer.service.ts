import { Injectable } from '@nestjs/common';
import { CreateLaporancontainerDto } from './dto/create-laporancontainer.dto';
import { UpdateLaporancontainerDto } from './dto/update-laporancontainer.dto';

@Injectable()
export class LaporancontainerService {
  create(createLaporancontainerDto: CreateLaporancontainerDto) {
    return 'This action adds a new laporancontainer';
  }

  findAll() {
    return `This action returns all laporancontainer`;
  }

  findOne(id: number) {
    return `This action returns a #${id} laporancontainer`;
  }

  update(id: number, updateLaporancontainerDto: UpdateLaporancontainerDto) {
    return `This action updates a #${id} laporancontainer`;
  }

  remove(id: number) {
    return `This action removes a #${id} laporancontainer`;
  }
}
