import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UsePipes, Query, InternalServerErrorException } from '@nestjs/common';
import { JenisprosesfeeService } from './jenisprosesfee.service';
import { CreateJenisprosesfeeDto } from './dto/create-jenisprosesfee.dto';
import { UpdateJenisprosesfeeDto } from './dto/update-jenisprosesfee.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { FindAllDto, FindAllParams, FindAllSchema } from 'src/common/interfaces/all.interface';
import { dbMssql } from 'src/common/utils/db';

@Controller('jenisprosesfee')
export class JenisprosesfeeController {
  constructor(private readonly jenisprosesfeeService: JenisprosesfeeService) {}

  @UseGuards(AuthGuard)
  @Post()
  //@JENISPROSESFEE
  async  create(@Body() createJenisprosesfeeDto: CreateJenisprosesfeeDto) {
    return this.jenisprosesfeeService.create(createJenisprosesfeeDto);
  }

  @Get()
  //@JENISPROSESFEE
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
      sort: sortParams as { sortBy: string; sortDirection: 'asc' | 'desc' },
      isLookUp: isLookUp === 'true',
    };
    const trx = await dbMssql.transaction();
    try {
      const result = await this.jenisprosesfeeService.findAll(params, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching all jenis biaya marketing:', error);
      throw new InternalServerErrorException(
        'Failed to fetch jenis biaya marketing',
      );
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jenisprosesfeeService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateJenisprosesfeeDto: UpdateJenisprosesfeeDto) {
    return this.jenisprosesfeeService.update(+id, updateJenisprosesfeeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.jenisprosesfeeService.remove(+id);
  }
}
