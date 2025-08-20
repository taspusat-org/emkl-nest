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
  UsePipes,
  Query,
  Put,
} from '@nestjs/common';
import { dbMssql } from 'src/common/utils/db';
import { AuthGuard } from '../auth/auth.guard';
import { ScheduleHeaderService } from './schedule-header.service';
import { CreateScheduleHeaderDto } from './dto/create-schedule-header.dto';
import { UpdateScheduleHeaderDto } from './dto/update-schedule-header.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';

@Controller('schedule-header')
export class ScheduleHeaderController {
  constructor(private readonly scheduleHeaderService: ScheduleHeaderService) {}

  @UseGuards(AuthGuard)
  @Post()
  //@SCHEDULE-HEADER
  async create(@Body() data: any, @Req() req) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';
      // console.log('masuk sinii??', data, data.modifiedby);

      const result = await this.scheduleHeaderService.create(data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Error: ${error.message}`);
    }
  }

  @Get()
  //@SCHEDULE-HEADER
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
      const result = await this.scheduleHeaderService.findAll(params, trx);
      trx.commit();

      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error in findAll Controller Schedule Header:', error);
      throw error; // Re-throw the error to be handled by the global exception filter
    }
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  //@SCHEDULE-HEADER
  async update(
    @Param('id')
    id: string,
    @Body() data: any,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';
      // console.log('data', data);
      const result = await this.scheduleHeaderService.update(+id, data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error updating schedule header in controller:', error);
      throw new Error('Failed to update schedule header in controller');
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  //@SCHEDULE-HEADER
  async delete(
    @Param('id')
    id: string,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    const modifiedby = req.user?.user?.username || 'unknown';
    try {
      const result = await this.scheduleHeaderService.delete(
        +id,
        trx,
        modifiedby,
      );

      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error deleting pengembaliankasgantungheader:', error);
      throw new Error(
        `Error deleting pengembaliankasgantungheader: ${error.message}`,
      );
    }
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.scheduleHeaderService.findOne(+id);
  // }
}
