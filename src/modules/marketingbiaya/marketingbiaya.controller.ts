import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { MarketingbiayaService } from './marketingbiaya.service';
import { CreateMarketingbiayaDto } from './dto/create-marketingbiaya.dto';
import { UpdateMarketingbiayaDto } from './dto/update-marketingbiaya.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('marketingbiaya')
export class MarketingbiayaController {
  constructor(private readonly marketingbiayaService: MarketingbiayaService) {}

  @Post()
  create(@Body() createMarketingbiayaDto: CreateMarketingbiayaDto) {
    return this.marketingbiayaService.create(createMarketingbiayaDto);
  }

  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.marketingbiayaService.findAll(id, trx);

      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error(
        'Error fetching data marketing ordean in controller ',
        error,
      );
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketingbiayaService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMarketingbiayaDto: UpdateMarketingbiayaDto,
  ) {
    return this.marketingbiayaService.update(+id, updateMarketingbiayaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketingbiayaService.remove(+id);
  }
}
