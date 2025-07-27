import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  UsePipes,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
import { AlatbayarService } from './alatbayar.service';
import { CreateAlatbayarDto } from './dto/create-alatbayar.dto';
import { UpdateAlatbayarDto } from './dto/update-alatbayar.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { dbMssql } from 'src/common/utils/db';
@Controller('alatbayar')
export class AlatbayarController {
  constructor(private readonly alatbayarService: AlatbayarService) {}

  @Post()
  create(@Body() createAlatbayarDto: CreateAlatbayarDto) {
    return this.alatbayarService.create(createAlatbayarDto);
  }

  @Get()
  //@PENGEMBALIAN-KAS-GANTUNG
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
      const result = await this.alatbayarService.findAll(params, trx);
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
    return this.alatbayarService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAlatbayarDto: UpdateAlatbayarDto,
  ) {
    return this.alatbayarService.update(+id, updateAlatbayarDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.alatbayarService.remove(+id);
  }
}
