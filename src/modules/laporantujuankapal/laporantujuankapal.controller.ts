import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LaporantujuankapalService } from './laporantujuankapal.service';
import { CreateLaporantujuankapalDto } from './dto/create-laporantujuankapal.dto';
import { UpdateLaporantujuankapalDto } from './dto/update-laporantujuankapal.dto';

@Controller('laporantujuankapal')
export class LaporantujuankapalController {
  constructor(private readonly laporantujuankapalService: LaporantujuankapalService) {}

  @Post()
  create(@Body() createLaporantujuankapalDto: CreateLaporantujuankapalDto) {
    return this.laporantujuankapalService.create(createLaporantujuankapalDto);
  }

  @Get()
  findAll() {
    return this.laporantujuankapalService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.laporantujuankapalService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLaporantujuankapalDto: UpdateLaporantujuankapalDto) {
    return this.laporantujuankapalService.update(+id, updateLaporantujuankapalDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.laporantujuankapalService.remove(+id);
  }
}
