import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MarketingmanagerService } from './marketingmanager.service';
import { CreateMarketingmanagerDto } from './dto/create-marketingmanager.dto';
import { UpdateMarketingmanagerDto } from './dto/update-marketingmanager.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('marketingmanager')
export class MarketingmanagerController {
  constructor(private readonly marketingmanagerService: MarketingmanagerService) {}

  @Post()
  create(@Body() createMarketingmanagerDto: CreateMarketingmanagerDto) {
    return this.marketingmanagerService.create(createMarketingmanagerDto);
  }

  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      console.log('masukk kesinii?');
      
      const result = await this.marketingmanagerService.findAll(id, trx);
      console.log('return data from service', result);
      
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching data marketing ordean in controller ', error);
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketingmanagerService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMarketingmanagerDto: UpdateMarketingmanagerDto) {
    return this.marketingmanagerService.update(+id, updateMarketingmanagerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketingmanagerService.remove(+id);
  }
}
