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
  findOne(@Param('id') id: string) {
    return this.penerimaandetailService.findOne(+id);
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
