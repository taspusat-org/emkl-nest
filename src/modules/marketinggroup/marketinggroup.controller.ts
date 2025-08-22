import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  UsePipes,
  Query,
  InternalServerErrorException,
  Put,
  NotFoundException,
} from '@nestjs/common';
import { MarketinggroupService } from './marketinggroup.service';
import {
  CreateMarketinggroupDto,
  CreateMarketinggroupSchema,
} from './dto/create-marketinggroup.dto';
import { UpdateMarketinggroupDto, UpdateMarketinggroupSchema } from './dto/update-marketinggroup.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { KeyboardOnlyValidationPipe } from 'src/common/pipes/keyboardonly-validation.pipe';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { isRecordExist } from 'src/utils/utils.service';

@Controller('marketinggroup')
export class MarketinggroupController {
  constructor(private readonly marketinggroupService: MarketinggroupService) {}

  @UseGuards(AuthGuard)
  @Post()
  //@MARKETING-GROUP
  async create(
    @Body(
      new ZodValidationPipe(CreateMarketinggroupSchema),
      KeyboardOnlyValidationPipe,
    )
    data: CreateMarketinggroupDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';
      const result = await this.marketinggroupService.create(data, trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error(
        'Error while creating marketing group in controller',
        error,
      );
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      // Generic error handling, if something unexpected happens
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to create marketing group ',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  //@MARKETING-GROUP
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: FindAllDto) {
    const { search, page, limit, sortBy, sortDirection, isLookUp, ...filters } =
      query;

    const sortParams = {
      sortBy: sortBy || 'marketing_id',
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
      const result = await this.marketinggroupService.findAll(params, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching all marketing group:', error);
      throw new InternalServerErrorException('Failed to fetch marketing group');
    }
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  //@MARKETING-GROUP
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMarketinggroupSchema))
    data: UpdateMarketinggroupDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.marketinggroupService.update(
        +id,
        data,
        trx,
      );

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error(
        'Error updating marketing group in controller:',
        error,
      );
      // Ensure any other errors get caught and returned
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      // Generic error handling, if something unexpected happens
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to update marketing group',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  //@MARKETING-GROUP
  async delete(@Param('id') id: string, @Req() req) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.marketinggroupService.delete(
        +id,
        trx,
        req.user?.user?.username,
      );

      if (result.status === 404) {
        throw new NotFoundException(result.message);
      }

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error(
        'Error deleting marketing group in controller:',
        error,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to delete marketing group',
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.marketinggroupService.getById(+id, trx);
      if (!result) {
        throw new Error('Data not found');
      }

      await trx.commit();
      return result;
    } catch (error) {
      console.error('Error fetching data by id:', error);

      await trx.rollback();
      throw new Error('Failed to fetch data by id');
    }
  }
}
