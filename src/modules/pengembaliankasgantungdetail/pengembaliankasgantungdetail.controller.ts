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

@Controller('pengembaliankasgantungdetail')
export class PengembaliankasgantungdetailController {
  constructor(
    private readonly pengembaliankasgantungdetailService: PengembaliankasgantungdetailService,
  ) {}

  @Post()
  create(
    @Body()
    createPengembaliankasgantungdetailDto: CreatePengembaliankasgantungdetailDto,
  ) {
    return this.pengembaliankasgantungdetailService.create(
      createPengembaliankasgantungdetailDto,
    );
  }

  @Get()
  async findAll(
    @Query()
    query: {
      tanggalDari: string;
      tanggalSampai: string;
    },
  ) {
    const { tanggalDari, tanggalSampai } = query;
    const result = await this.pengembaliankasgantungdetailService.findAll(
      tanggalDari,
      tanggalSampai,
    );
    return result;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pengembaliankasgantungdetailService.findOne(+id);
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
