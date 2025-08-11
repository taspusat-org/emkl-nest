import { Injectable } from '@nestjs/common';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';

@Injectable()
export class ContainerService {
  create(createContainerDto: CreateContainerDto) {
    return 'This action adds a new container';
  }

  findAll() {
    return `This action returns all container`;
  }

  findOne(id: number) {
    return `This action returns a #${id} container`;
  }

  update(id: number, updateContainerDto: UpdateContainerDto) {
    return `This action updates a #${id} container`;
  }

  remove(id: number) {
    return `This action removes a #${id} container`;
  }
}
