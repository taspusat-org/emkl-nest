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
  InternalServerErrorException,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Put,
  NotFoundException,
} from '@nestjs/common';
import { JenisbiayamarketingService } from './jenisbiayamarketing.service';
import {
  CreateJenisbiayamarketingDto,
  CreateJenisbiayamarketingSchema,
} from './dto/create-jenisbiayamarketing.dto';
import {
  UpdateJenisbiayamarketingDto,
  UpdateJenisbiayamarketingSchema,
} from './dto/update-jenisbiayamarketing.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { dbMssql } from 'src/common/utils/db';
import { AuthGuard } from '../auth/auth.guard';
import { KeyboardOnlyValidationPipe } from 'src/common/pipes/keyboardonly-validation.pipe';
import { isRecordExist } from 'src/utils/utils.service';

@Controller('jenisbiayamarketing')
export class JenisbiayamarketingController {
  constructor(
    private readonly jenisbiayamarketingService: JenisbiayamarketingService,
  ) {}

  @UseGuards(AuthGuard)
  @Post()
  //@JENIS-BIAYA-MARKETING
  async create(
    @Body(
      new ZodValidationPipe(CreateJenisbiayamarketingSchema),
      KeyboardOnlyValidationPipe,
    )
    data: CreateJenisbiayamarketingDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';
      const result = await this.jenisbiayamarketingService.create(data, trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error(
        'Error while creating jenis biaya marketing in controller',
        error,
      );
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      // Generic error handling, if something unexpected happens
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to create jenis biaya marketing',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  //@JENIS-BIAYA-MARKETING
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
      const result = await this.jenisbiayamarketingService.findAll(params, trx);
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

  @UseGuards(AuthGuard)
  @Put(':id')
  //@JENIS-BIAYA-MARKETING
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateJenisbiayamarketingSchema))
    data: UpdateJenisbiayamarketingDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      const emklExist = await isRecordExist(
        'nama',
        data.nama,
        'jenisbiayamarketing',
        Number(id),
      );

      if (emklExist) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: `Jenis biaya marketing dengan nama ${data.nama} sudah ada`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.jenisbiayamarketingService.update(
        +id,
        data,
        trx,
      );

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error(
        'Error updating jenis biaya marketing in controller:',
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
          message: 'Failed to update jenis biaya marketing',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  //@JENIS-BIAYA-MARKETING
  async delete(@Param('id') id: string, @Req() req) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.jenisbiayamarketingService.delete(
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
      console.error(
        'Error deleting jenis biaya marketing in controller:',
        error,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to delete jenis biaya marketing',
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.jenisbiayamarketingService.getById(+id, trx);
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
