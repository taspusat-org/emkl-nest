import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  UseGuards,
  Query,
  Req,
  Put,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { KapalService } from './kapal.service';
import { CreateKapalDto, CreateKapalSchema } from './dto/create-kapal.dto';
import { UpdateKapalDto, UpdateKapalSchema } from './dto/update-kapal.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { AuthGuard } from '../auth/auth.guard';
import { dbMssql } from 'src/common/utils/db';

@Controller('kapal')
export class KapalController {
  constructor(private readonly kapalService: KapalService) {}

  @UseGuards(AuthGuard)
  @Post()
  //@KAPAL
  async create(
    @Body(new ZodValidationPipe(CreateKapalSchema))
    data: CreateKapalDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.kapalService.create(data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Error creating parameter: ${error.message}`);
    }
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
      isLookUp: isLookUp === 'true',

      sort: sortParams as { sortBy: string; sortDirection: 'asc' | 'desc' },
    };
    const trx = await dbMssql.transaction();
    try {
      const result = await this.kapalService.findAll(params, trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Error fetching kapal: ${error.message}`);
    }
  }
  @Get(':id')
  @UseGuards(AuthGuard)
  @Get(':id')
  //@KAPAL
  async findOne(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.kapalService.getById(+id, trx);
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

  @UseGuards(AuthGuard)
  @Put(':id')
  //@KAPAL
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateKapalSchema))
    data: UpdateKapalDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';
      const result = await this.kapalService.update(+id, data, trx);
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
  //@KAPAL
  async delete(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.kapalService.delete(+id, trx);
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
}
