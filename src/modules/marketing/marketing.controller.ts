import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, UsePipes, Query } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { CreateMarketingDto, CreateMarketingSchema } from './dto/create-marketing.dto';
// import { UpdateMarketingDto } from './dto/update-marketing.dto';
import { AuthGuard } from '../auth/auth.guard';
import { dbMssql } from 'src/common/utils/db';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { FindAllDto, FindAllParams, FindAllSchema } from 'src/common/interfaces/all.interface';

@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @UseGuards(AuthGuard)
  @Post()
  //@MARKETING
  async create(
    @Body(new ZodValidationPipe(CreateMarketingSchema)) 
    data: any,
    @Req() req
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.modifiedby || 'unknown';
      const result = await this.marketingService.create(data, trx)
      
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Error: ${error.message}`)
    }
  }

  @Get()
  //@MARKETING
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query:FindAllDto) {
    const {
      search,
      page,
      limit,
      sortBy,
      sortDirection,
      isLookUp,
      ...filters
    } = query
    
    const sortParams = {
      sortBy: sortBy || 'nobukti',
      sortDirection: sortDirection || 'asc'
    }

    const pagination = {
      page: page || 1,
      limit: limit === 0 || !limit ? undefined : limit
    }

    const params: FindAllParams = {
      search,
      filters,
      pagination,
      sort: sortParams as { sortBy: string; sortDirection: 'asc' | 'desc' },
      isLookUp: isLookUp === 'true'
    }

    const trx = await dbMssql.transaction();

    try {
      const result = await this.marketingService.findAll(params, trx)
      trx.commit();

      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error in findAll Controller Marketing:', error);
      throw error; // Re-throw the error to be handled by the global exception filter
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketingService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.marketingService.update(+id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketingService.remove(+id);
  }
}
