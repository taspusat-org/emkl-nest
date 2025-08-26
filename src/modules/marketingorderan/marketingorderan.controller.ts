import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { MarketingorderanService } from './marketingorderan.service';
import { CreateMarketingorderanDto } from './dto/create-marketingorderan.dto';
import { UpdateMarketingorderanDto } from './dto/update-marketingorderan.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('marketingorderan')
export class MarketingorderanController {
  constructor(
    private readonly marketingorderanService: MarketingorderanService,
  ) {}

  @Post()
  create(@Body() createMarketingorderanDto: CreateMarketingorderanDto) {
    return this.marketingorderanService.create(createMarketingorderanDto);
  }

  @Get(':id')
  async findAll(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      // console.log('masuk sinii');

      const result = await this.marketingorderanService.findAll(id, trx);

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
    return this.marketingorderanService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMarketingorderanDto: UpdateMarketingorderanDto,
  ) {
    return this.marketingorderanService.update(+id, updateMarketingorderanDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketingorderanService.remove(+id);
  }
}
