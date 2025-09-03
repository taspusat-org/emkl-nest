import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PengeluarandetailService } from './pengeluarandetail.service';
import { CreatePengeluarandetailDto } from './dto/create-pengeluarandetail.dto';
import { UpdatePengeluarandetailDto } from './dto/update-pengeluarandetail.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('pengeluarandetail')
export class PengeluarandetailController {
  constructor(
    private readonly pengeluarandetailService: PengeluarandetailService,
  ) {}

  @Post()
  create(@Body() createPengeluarandetailDto: CreatePengeluarandetailDto) {
    return this.pengeluarandetailService.create(createPengeluarandetailDto);
  }

  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.pengeluarandetailService.findAll(id, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching pengeluaran detail:', error);
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pengeluarandetailService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePengeluarandetailDto: UpdatePengeluarandetailDto,
  ) {
    return this.pengeluarandetailService.update(
      +id,
      updatePengeluarandetailDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pengeluarandetailService.remove(+id);
  }
}
