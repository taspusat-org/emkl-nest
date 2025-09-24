import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { StatusjobService } from './statusjob.service';
import { CreateStatusjobDto } from './dto/create-statusjob.dto';
import { UpdateStatusjobDto } from './dto/update-statusjob.dto';

@Controller('statusjob')
export class StatusjobController {
  constructor(private readonly statusjobService: StatusjobService) {}

  @Post()
  create(@Body() createStatusjobDto: CreateStatusjobDto) {
    return this.statusjobService.create(createStatusjobDto);
  }

  @Get()
  findAll() {
    return this.statusjobService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.statusjobService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateStatusjobDto: UpdateStatusjobDto,
  ) {
    return this.statusjobService.update(+id, updateStatusjobDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.statusjobService.remove(+id);
  }
}
