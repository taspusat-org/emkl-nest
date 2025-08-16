import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  Query,
} from '@nestjs/common';
import { EmklService } from './emkl.service';
import { CreateEmklDto } from './dto/create-emkl.dto';
import { UpdateEmklDto } from './dto/update-emkl.dto';
import { dbMssql } from 'src/common/utils/db';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';

@Controller('emkl')
export class EmklController {
  constructor(private readonly emklService: EmklService) {}

  @Post()
  create(@Body() createEmklDto: CreateEmklDto) {
    return this.emklService.create(createEmklDto);
  }

  @Get()
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
      const result = await this.emklService.findAll(params, trx);
      trx.commit();

      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error in findAll:', error);
      throw error;
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.emklService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEmklDto: UpdateEmklDto) {
    return this.emklService.update(+id, updateEmklDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.emklService.remove(+id);
  }
}
