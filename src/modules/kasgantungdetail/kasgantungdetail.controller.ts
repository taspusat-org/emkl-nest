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
import { FindAllDto, FindAllParams } from 'src/common/interfaces/all.interface';

@Controller('kasgantungdetail')
export class KasgantungdetailController {
  constructor(
    private readonly kasgantungdetailService: KasgantungdetailService,
  ) {}

  @Post()
  create(@Body() createKasgantungdetailDto: CreateKasgantungdetailDto) {
    return this.kasgantungdetailService.create(createKasgantungdetailDto);
  }

  @Get('/detail')
  async findAll(
    @Query('mainNobukti') mainNobukti: string,
    @Query() query: FindAllDto,
  ) {
    const { search, page, limit, sortBy, sortDirection, isLookUp, ...filters } =
      query;

    const trx = await dbMssql.transaction();
    const sortParams = {
      sortBy: sortBy || 'nobukti',
      sortDirection: sortDirection || 'asc',
    };

    const pagination = {
      page: page || 1,
      limit: limit === 0 || !limit ? undefined : limit,
    };

    const params: FindAllParams = {
      search,
      filters,
      pagination,
      isLookUp: isLookUp === 'true',
      sort: sortParams as { sortBy: string; sortDirection: 'asc' | 'desc' },
    };
    try {
      const result = await this.kasgantungdetailService.findAll(
        trx,
        mainNobukti,
        params,
      );
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching kas gantung detail:', error);
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
