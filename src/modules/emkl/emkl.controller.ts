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
import { EmklService } from './emkl.service';
import { CreateEmklDto, CreateEmklSchema } from './dto/create-emkl.dto';
import { UpdateEmklDto, UpdateEmklSchema } from './dto/update-emkl.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { KeyboardOnlyValidationPipe } from 'src/common/pipes/keyboardonly-validation.pipe';
import { dbMssql } from 'src/common/utils/db';
import { isRecordExist } from 'src/utils/utils.service';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { query } from 'express';

@Controller('emkl')
export class EmklController {
  constructor(private readonly emklService: EmklService) {}

  @UseGuards(AuthGuard)
  @Post()
  //@EMKL
  async create(
    @Body(new ZodValidationPipe(CreateEmklSchema), KeyboardOnlyValidationPipe)
    data: CreateEmklDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      const emklExist = await isRecordExist('nama', data.nama, 'emkl');

      if (emklExist) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: `emkl dengan nama ${data.nama} sudah ada`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      data.modifiedby = req.user?.user?.username || 'unknown';
      const result = await this.emklService.create(data, trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error while creating type emkl in controller', error);
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      // Generic error handling, if something unexpected happens
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to create type emkl',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  //@EMKL
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
      console.error('Error fetching all emkl:', error);
      throw new InternalServerErrorException('Failed to fetch emkl');
    }
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  //@EMKL
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateEmklSchema)) data: UpdateEmklDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      const emklExist = await isRecordExist(
        'nama',
        data.nama,
        'emkl',
        Number(id),
      );

      if (emklExist) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: `Emkl dengan nama ${data.nama} sudah ada`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.emklService.update(+id, data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error updating emkl in controller:', error);
      // Ensure any other errors get caught and returned
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      // Generic error handling, if something unexpected happens
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to update emkl',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  //@EMKL
  async delete(@Param('id') id: string, @Req() req) {
      const trx = await dbMssql.transaction();
      try {
        const result = await this.emklService.delete(
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
        console.error('Error deleting emkl in controller:', error);
  
        if (error instanceof NotFoundException) {
          throw error;
        }
  
        throw new InternalServerErrorException('Failed to delete emkl');
      }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.emklService.getById(+id, trx);
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
