import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MarketingprosesfeeService } from './marketingprosesfee.service';
import { CreateMarketingprosesfeeDto } from './dto/create-marketingprosesfee.dto';
import { UpdateMarketingprosesfeeDto } from './dto/update-marketingprosesfee.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('marketingprosesfee')
export class MarketingprosesfeeController {
  constructor(private readonly marketingprosesfeeService: MarketingprosesfeeService) {}

  @Post()
  create(@Body() createMarketingprosesfeeDto: CreateMarketingprosesfeeDto) {
    return this.marketingprosesfeeService.create(createMarketingprosesfeeDto);
  }

  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.marketingprosesfeeService.findAll(id, trx);
      
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching data marketing proses fee in controller ', error);
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketingprosesfeeService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMarketingprosesfeeDto: UpdateMarketingprosesfeeDto) {
    return this.marketingprosesfeeService.update(+id, updateMarketingprosesfeeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketingprosesfeeService.remove(+id);
  }
}
