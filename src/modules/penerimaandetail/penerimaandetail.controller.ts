import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PenerimaandetailService } from './penerimaandetail.service';
import { CreatePenerimaandetailDto } from './dto/create-penerimaandetail.dto';
import { UpdatePenerimaandetailDto } from './dto/update-penerimaandetail.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('penerimaandetail')
export class PenerimaandetailController {
  constructor(
    private readonly penerimaandetailService: PenerimaandetailService,
  ) {}

  @Post()
  create(@Body() createPenerimaandetailDto: CreatePenerimaandetailDto) {
    return this.penerimaandetailService.create(createPenerimaandetailDto);
  }

  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.penerimaandetailService.findAll(id, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching penerimaandetail:', error);
    }
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePenerimaandetailDto: UpdatePenerimaandetailDto,
  ) {
    return this.penerimaandetailService.update(+id, updatePenerimaandetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.penerimaandetailService.remove(+id);
  }
}
