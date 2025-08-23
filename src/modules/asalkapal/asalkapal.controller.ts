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
  InternalServerErrorException,
  HttpException,
  HttpStatus,
  Put,
  NotFoundException,
} from '@nestjs/common';
import { AsalkapalService } from './asalkapal.service';
import {
  CreateAsalkapalDto,
  CreateAsalKapalSchema,
} from './dto/create-asalkapal.dto';
import {
  UpdateAsalkapalDto,
  UpdateAsalKapalSchema,
} from './dto/update-asalkapal.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { string } from 'zod';
import { dbMssql } from 'src/common/utils/db';
import { AuthGuard } from '../auth/auth.guard';
import { isRecordExist } from 'src/utils/utils.service';

@Controller('asalkapal')
export class AsalkapalController {
  constructor(private readonly asalkapalService: AsalkapalService) {}

  @UseGuards(AuthGuard)
  //@ASALKAPAL
  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateAsalKapalSchema))
    data: CreateAsalkapalDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();

    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.asalkapalService.create(data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Error creating parameter: ${error.message}`);
    }
  }

  @UseGuards(AuthGuard)
  //@ASALKAPAL
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
      const result = await this.asalkapalService.findAll(params, trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Error fetching kapal: ${error.message}`);
    }
  }

  @Post('check-validation')
  //@ASALKAPAL
  @UseGuards(AuthGuard)
  async checkValidasi(@Body() body: { aksi: string; value: any }, @Req() req) {
    const { aksi, value } = body;
    console.log('body', body);
    const trx = await dbMssql.transaction();
    const editedby = req.user?.user?.username;

    try {
      const forceEdit = await this.asalkapalService.checkValidasi(
        aksi,
        value,
        editedby,
        trx,
      );
      trx.commit();
      return forceEdit;
    } catch (error) {
      trx.rollback();
      console.error('Error checking validation:', error);
      throw new InternalServerErrorException('Failed to check validation');
    }
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.asalkapalService.findOne(+id);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  //@ASALKAPAL
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAsalKapalSchema))
    data: UpdateAsalkapalDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();

    try {
      const asalkapalExist = await isRecordExist(
        'keterangan',
        data.keterangan,
        'asalkapal',
        Number(id),
      );

      if (asalkapalExist) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: `Type Akuntansi dengan keterangan ${data.keterangan} sudah ada`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.asalkapalService.update(+id, data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error(
        'Error while updating type akuntansi in controller:',
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
          message: 'Failed to update type akuntansi',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  //@ASALKAPAL
  async delete(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.asalkapalService.delete(+id, trx);
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
