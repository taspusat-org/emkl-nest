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
import { JurnalumumdetailService } from './jurnalumumdetail.service';
import { CreateJurnalumumdetailDto } from './dto/create-jurnalumumdetail.dto';
import { UpdateJurnalumumdetailDto } from './dto/update-jurnalumumdetail.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('jurnalumumdetail')
export class JurnalumumdetailController {
  constructor(
    private readonly jurnalumumdetailService: JurnalumumdetailService,
  ) {}

  @Post()
  create(@Body() createJurnalumumdetailDto: CreateJurnalumumdetailDto) {
    return this.jurnalumumdetailService.create(createJurnalumumdetailDto);
  }

  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.jurnalumumdetailService.findAll(id, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching pengembalianjurnalumumdetail:', error);
    }
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateJurnalumumdetailDto: UpdateJurnalumumdetailDto,
  ) {
    return this.jurnalumumdetailService.update(+id, updateJurnalumumdetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.jurnalumumdetailService.remove(+id);
  }
}
