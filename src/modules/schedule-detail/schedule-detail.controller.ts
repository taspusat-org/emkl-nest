import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ScheduleDetailService } from './schedule-detail.service';
import { CreateScheduleDetailDto } from './dto/create-schedule-detail.dto';
import { UpdateScheduleDetailDto } from './dto/update-schedule-detail.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('schedule-detail')
export class ScheduleDetailController {
  constructor(private readonly scheduleDetailService: ScheduleDetailService) {}

  @Post()
  create(@Body() createScheduleDetailDto: CreateScheduleDetailDto) {
    return this.scheduleDetailService.create(createScheduleDetailDto);
  }

  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.scheduleDetailService.findAll(id, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error(
        'Error fetching data schedule detail in controller ',
        error,
      );
    }
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateScheduleDetailDto: UpdateScheduleDetailDto,
  ) {
    return this.scheduleDetailService.update(+id, updateScheduleDetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scheduleDetailService.remove(+id);
  }
}
