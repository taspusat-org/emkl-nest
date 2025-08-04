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
import { KasgantungdetailService } from './kasgantungdetail.service';
import { CreateKasgantungdetailDto } from './dto/create-kasgantungdetail.dto';
import { UpdateKasgantungdetailDto } from './dto/update-kasgantungdetail.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('kasgantungdetail')
export class KasgantungdetailController {
  constructor(
    private readonly kasgantungdetailService: KasgantungdetailService,
  ) {}

  @Post()
  create(@Body() createKasgantungdetailDto: CreateKasgantungdetailDto) {
    return this.kasgantungdetailService.create(createKasgantungdetailDto);
  }

  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.kasgantungdetailService.findAll(id, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching pengembaliankasgantungdetail:', error);
    }
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateKasgantungdetailDto: UpdateKasgantungdetailDto,
  ) {
    return this.kasgantungdetailService.update(+id, updateKasgantungdetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.kasgantungdetailService.remove(+id);
  }
}
