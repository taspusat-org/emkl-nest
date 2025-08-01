import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UsePipes,
  UseGuards,
  Req,
} from '@nestjs/common';
import { KasgantungheaderService } from './kasgantungheader.service';
import { CreateKasgantungheaderDto } from './dto/create-kasgantungheader.dto';
import { UpdateKasgantungheaderDto } from './dto/update-kasgantungheader.dto';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { dbMssql } from 'src/common/utils/db';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';

@Controller('kasgantungheader')
export class KasgantungheaderController {
  constructor(
    private readonly kasgantungheaderService: KasgantungheaderService,
  ) {}

  @UseGuards(AuthGuard)
  @Post()
  //@PENGEMBALIAN-KAS-GANTUNG
  async create(
    @Body()
    data: any,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.kasgantungheaderService.create(data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Error: ${error.message}`);
    }
  }
  @Get()
  //@PENGEMBALIAN-KAS-GANTUNG
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: FindAllDto) {
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
      sort: sortParams as { sortBy: string; sortDirection: 'asc' | 'desc' },
      isLookUp: isLookUp === 'true',
    };
    const trx = await dbMssql.transaction();

    try {
      const result = await this.kasgantungheaderService.findAll(params, trx);
      trx.commit();

      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error in findAll:', error);
      throw error; // Re-throw the error to be handled by the global exception filter
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.kasgantungheaderService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateKasgantungheaderDto: UpdateKasgantungheaderDto,
  ) {
    return this.kasgantungheaderService.update(+id, updateKasgantungheaderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.kasgantungheaderService.remove(+id);
  }
}
