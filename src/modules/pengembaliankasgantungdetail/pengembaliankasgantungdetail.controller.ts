import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { PengembaliankasgantungdetailService } from './pengembaliankasgantungdetail.service';
import { CreatePengembaliankasgantungdetailDto } from './dto/create-pengembaliankasgantungdetail.dto';
import { UpdatePengembaliankasgantungdetailDto } from './dto/update-pengembaliankasgantungdetail.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('pengembaliankasgantungdetail')
export class PengembaliankasgantungdetailController {
  constructor(
    private readonly pengembaliankasgantungdetailService: PengembaliankasgantungdetailService,
  ) {}

  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.pengembaliankasgantungdetailService.findAll(
        id,
        trx,
      );
      return result;
    } catch (error) {
      console.error('Error fetching pengembaliankasgantungdetail:', error);
    }
  }
  @Get()
  async tes(
    @Query()
    query: {
      tanggalDari: string;
      tanggalSampai: string;
    },
  ) {
    const { tanggalDari, tanggalSampai } = query;
    const result = await this.pengembaliankasgantungdetailService.tes(
      tanggalDari,
      tanggalSampai,
    );
    return result;
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    updatePengembaliankasgantungdetailDto: UpdatePengembaliankasgantungdetailDto,
  ) {
    return this.pengembaliankasgantungdetailService.update(
      +id,
      updatePengembaliankasgantungdetailDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pengembaliankasgantungdetailService.remove(+id);
  }
}
