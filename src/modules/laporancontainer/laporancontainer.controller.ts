import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LaporancontainerService } from './laporancontainer.service';
import { CreateLaporancontainerDto } from './dto/create-laporancontainer.dto';
import { UpdateLaporancontainerDto } from './dto/update-laporancontainer.dto';

@Controller('laporancontainer')
export class LaporancontainerController {
  constructor(private readonly laporancontainerService: LaporancontainerService) {}

  @Post()
  create(@Body() createLaporancontainerDto: CreateLaporancontainerDto) {
    return this.laporancontainerService.create(createLaporancontainerDto);
  }

  @Get()
  findAll() {
    return this.laporancontainerService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.laporancontainerService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLaporancontainerDto: UpdateLaporancontainerDto) {
    return this.laporancontainerService.update(+id, updateLaporancontainerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.laporancontainerService.remove(+id);
  }
}
