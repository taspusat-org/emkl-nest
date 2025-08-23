import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MarketingdetailService } from './marketingdetail.service';
import { CreateMarketingdetailDto } from './dto/create-marketingdetail.dto';
import { UpdateMarketingdetailDto } from './dto/update-marketingdetail.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('marketingdetail')
export class MarketingdetailController {
  constructor(private readonly marketingdetailService: MarketingdetailService) {}

  @Post()
  create(@Body() createMarketingdetailDto: CreateMarketingdetailDto) {
    return this.marketingdetailService.create(createMarketingdetailDto);
  }
  
  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.marketingdetailService.findAll(id, trx);
      
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching data marketing detail in controller ', error);
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketingdetailService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMarketingdetailDto: UpdateMarketingdetailDto) {
    return this.marketingdetailService.update(+id, updateMarketingdetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketingdetailService.remove(+id);
  }
}
