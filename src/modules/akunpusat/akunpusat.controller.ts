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
  Req,
  UseGuards,
} from '@nestjs/common';
import { AkunpusatService } from './akunpusat.service';
import { CreateAkunpusatDto } from './dto/create-akunpusat.dto';
import { UpdateAkunpusatDto } from './dto/update-akunpusat.dto';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';

@Controller('akunpusat')
export class AkunpusatController {
  constructor(private readonly akunpusatService: AkunpusatService) {}

  @UseGuards(AuthGuard)
  @Post()
  async create(
    @Body()
    data,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.akunpusatService.create(data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Error creating menu: ${error.message}`);
    }
  }

  @Get()
  //@KAS-GANTUNG
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: FindAllDto) {
    const { search, page, limit, sortBy, sortDirection, isLookUp, ...filters } =
      query;

    const sortParams = {
      sortBy: sortBy || 'coa',
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
      const result = await this.akunpusatService.findAll(params, trx);
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
    return this.akunpusatService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAkunpusatDto: UpdateAkunpusatDto,
  ) {
    return this.akunpusatService.update(+id, updateAkunpusatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.akunpusatService.remove(+id);
  }
}
