import {
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  UsePipes,
  Controller,
  InternalServerErrorException,
} from '@nestjs/common';
import { dbMssql } from 'src/common/utils/db';
import { GandenganService } from './gandengan.service';
import { CreateGandenganDto } from './dto/create-gandengan.dto';
import { UpdateGandenganDto } from './dto/update-gandengan.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';

@Controller('gandengan')
export class GandenganController {
  constructor(private readonly gandenganService: GandenganService) {}

  @Post()
  create(@Body() createGandenganDto: CreateGandenganDto) {
    return this.gandenganService.create(createGandenganDto);
  }

  @Get()
  //@GANDENGAN
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: FindAllDto) {
    const { search, page, limit, sortBy, sortDirection, isLookUp, ...filters } =
      query;

    const sortParams = {
      sortBy: sortBy || 'nama',
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
      const result = await this.gandenganService.findAll(params, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error(
        'Error fetching all gandengan in controller:',
        error,
        'ini error message',
        error.message,
      );
      throw new InternalServerErrorException(
        'Failed to fetch gandengan in controller',
      );
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gandenganService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateGandenganDto: UpdateGandenganDto,
  ) {
    return this.gandenganService.update(+id, updateGandenganDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gandenganService.remove(+id);
  }
}
