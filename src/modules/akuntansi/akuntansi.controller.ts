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
  UseGuards,
  Req,
  Put,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AkuntansiService } from './akuntansi.service';
import {
  CreateAkuntansiDto,
  CreateAkuntansiSchema,
} from './dto/create-akuntansi.dto';
import {
  UpdateAkuntansiDto,
  UpdateAkuntansiSchema,
} from './dto/update-akuntansi.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { AuthGuard } from '../auth/auth.guard';
@Controller('akuntansi')
export class AkuntansiController {
  constructor(private readonly akuntansiService: AkuntansiService) {}

  @UseGuards(AuthGuard)
  @Post()
  //@AKUNTANSI
  async create(
    @Body(new ZodValidationPipe(CreateAkuntansiSchema))
    data: CreateAkuntansiDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.akuntansiService.create(data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Error creating parameter: ${error.message}`);
    }
  }

  @UseGuards(AuthGuard)
  @Get()
  //@AKUNTANSI
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: FindAllDto) {
    const { search, page, limit, sortBy, sortDirection, isLookUp, ...filters } =
      query;

    const sortParams = {
      sortBy: sortBy || 'title',
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
      const result = await this.akuntansiService.findAll(params, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching all akuntansi:', error);
      throw new InternalServerErrorException('Failed to fetch akuntansi');
    }
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  //@AKUNTANSI
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAkuntansiSchema))
    data: UpdateAkuntansiDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';
      const result = await this.akuntansiService.update(+id, data, trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error updating parameter in controller:', error);
      throw new Error('Failed to update parameter');
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  //@AKUNTANSI
  async delete(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.akuntansiService.delete(+id, trx);
      if (result.status === 404) {
        throw new NotFoundException(result.message);
      }
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error deleting menu in controller:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete menu');
    }
  }
  @UseGuards(AuthGuard)
  @Get(':id')
  //@AKUNTANSI
  async findOne(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.akuntansiService.getById(+id, trx);
      if (!result) {
        await trx.commit();
        return {
          status: '200',
          message: 'Data not found',
        };
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
