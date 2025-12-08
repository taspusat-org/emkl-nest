import { Injectable } from '@nestjs/common';
import { CreateTesmoduleDto } from './dto/create-tesmodule.dto';
import { UpdateTesmoduleDto } from './dto/update-tesmodule.dto';

@Injectable()
export class TesmoduleService {
  create(createTesmoduleDto: CreateTesmoduleDto) {
    return 'This action adds a new tesmodule';
  }

  findAll() {
    return `This action returns all tesmodule`;
  }

  findOne(id: number) {
    return `This action returns a #${id} tesmodule`;
  }

  update(id: number, updateTesmoduleDto: UpdateTesmoduleDto) {
    return `This action updates a #${id} tesmodule`;
  }

  remove(id: number) {
    return `This action removes a #${id} tesmodule`;
  }
}
