import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  InternalServerErrorException,
} from '@nestjs/common';
import { JurnalumumdetailService } from './jurnalumumdetail.service';
import { CreateJurnalumumdetailDto } from './dto/create-jurnalumumdetail.dto';
import { UpdateJurnalumumdetailDto } from './dto/update-jurnalumumdetail.dto';
import { dbMssql } from 'src/common/utils/db';
import { FindAllDto, FindAllParams } from 'src/common/interfaces/all.interface';

@Controller('jurnalumumdetail')
export class JurnalumumdetailController {
  constructor(
    private readonly jurnalumumdetailService: JurnalumumdetailService,
  ) {}

  @Post()
  create(@Body() createJurnalumumdetailDto: CreateJurnalumumdetailDto) {
    return this.jurnalumumdetailService.create(createJurnalumumdetailDto);
  }

  @Get('/detail')
  async findAll(
    @Query('mainNobukti') mainNobukti: string,
    @Query() query: FindAllDto,
  ) {
    const { search, page, limit, sortBy, sortDirection, isLookUp, ...filters } =
      query;

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

    const trx = await dbMssql.transaction();
    try {
      const result = await this.jurnalumumdetailService.findAll(
        trx,
        mainNobukti,
        params,
      );

      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error(
        'Error fetching data marketing orderan in controller ',
        error,
        error.message,
      );
      throw new InternalServerErrorException(
        'Failed to fetch marketing orderan in controller',
      );
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
