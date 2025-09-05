import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UsePipes,
  Query,
  Req,
  Put,
} from '@nestjs/common';
import { PenerimaanheaderService } from './penerimaanheader.service';
import { CreatePenerimaanheaderDto } from './dto/create-penerimaanheader.dto';
import { UpdatePenerimaanheaderDto } from './dto/update-penerimaanheader.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { dbMssql } from 'src/common/utils/db';

@Controller('penerimaanheader')
export class PenerimaanheaderController {
  constructor(
    private readonly penerimaanheaderService: PenerimaanheaderService,
  ) {}

  @UseGuards(AuthGuard)
  @Post()
  //@PENERIMAAN
  async create(
    @Body()
    data: any,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.penerimaanheaderService.create(data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('error', error);
      throw new Error(`Error: ${error.message}`);
    }
  }
  @UseGuards(AuthGuard)
  @Get()
  //@PENERIMAAN
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
      const result = await this.penerimaanheaderService.findAll(params, trx);
      trx.commit();

      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error in findAll:', error);
      throw error; // Re-throw the error to be handled by the global exception filter
    }
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  //@PENERIMAAN
  async update(@Param('id') id: string, @Body() data: any, @Req() req) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';
      console.log('data', data);
      const result = await this.penerimaanheaderService.update(+id, data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error updating menu in controller:', error);
      throw new Error('Failed to update menu');
    }
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.penerimaanheaderService.remove(+id);
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.penerimaanheaderService.findOne(+id);
  }
}
