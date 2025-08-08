import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ContainerService } from './container.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';

@Controller('container')
export class ContainerController {
  constructor(private readonly containerService: ContainerService) {}

  @Post()
  create(@Body() createContainerDto: CreateContainerDto) {
    return this.containerService.create(createContainerDto);
  }

  @Get()
  findAll() {
    return this.containerService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.containerService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateContainerDto: UpdateContainerDto) {
    return this.containerService.update(+id, updateContainerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.containerService.remove(+id);
  }
}
