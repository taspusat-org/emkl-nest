import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { HutangdetailService } from './hutangdetail.service';
import { CreateHutangdetailDto } from './dto/create-hutangdetail.dto';
import { UpdateHutangdetailDto } from './dto/update-hutangdetail.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('hutangdetail')
export class HutangdetailController {
  constructor(private readonly hutangdetailService: HutangdetailService) {}

  @Post()
  create(@Body() createHutangdetailDto: CreateHutangdetailDto) {
    return this.hutangdetailService.create(createHutangdetailDto);
  }

  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.hutangdetailService.findAll(id, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching pengeluaran detail:', error);
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hutangdetailService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() UpdateHutangdetailDto: UpdateHutangdetailDto,
  ) {
    return this.hutangdetailService.update(+id, UpdateHutangdetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.hutangdetailService.remove(+id);
  }
}
