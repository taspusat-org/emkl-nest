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
import { SandarkapalService } from './sandarkapal.service';
import {
  CreateSandarkapalDto,
  CreateSandarkapalSchema,
} from './dto/create-sandarkapal.dto';
import { UpdateSandarkapalDto } from './dto/update-sandarkapal.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { KeyboardOnlyValidationPipe } from 'src/common/pipes/keyboardonly-validation.pipe';
import { isRecordExist } from 'src/utils/utils.service';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { UpdateSandarkapalSchema } from '../sandarkapal/dto/update-sandarkapal.dto';

@Controller('sandarkapal')
export class SandarkapalController {
  constructor(private readonly sandarkapalService: SandarkapalService) {}

  @UseGuards(AuthGuard)
  @Post()
  //@SANDARKAPAL
  async create(
    @Body(
      new ZodValidationPipe(CreateSandarkapalSchema),
      KeyboardOnlyValidationPipe,
    )
    data: CreateSandarkapalDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      const sandarkapalExist = await isRecordExist(
        'nama',
        data.nama,
        'sandarkapal',
      );

      if (sandarkapalExist) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: `sandarkapal dengan nama ${data.nama} sudah ada`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      data.modifiedby = req.user?.user?.username || 'unknown';
      const result = await this.sandarkapalService.create(data, trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error(
        'Error while creating type sandarkapal in controller',
        error,
      );
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      // Generic error handling, if something unexpected happens
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to create type sandarkapal',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('check-validation')
  //@SANDARKAPAL
  @UseGuards(AuthGuard)
  async checkValidasi(@Body() body: { aksi: string; value: any }, @Req() req) {
    const { aksi, value } = body;
    console.log('body', body);
    const trx = await dbMssql.transaction();
    const editedby = req.user?.user?.username;

    try {
      const forceEdit = await this.sandarkapalService.checkValidasi(
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

  @Get()
  //@SANDARKAPAL
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
      const result = await this.sandarkapalService.findAll(params, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error fetching all sandarkapal:', error);
      throw new InternalServerErrorException('Failed to fetch sandarkapal');
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.sandarkapalService.getById(+id, trx);
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

  @UseGuards(AuthGuard)
  @Put(':id')
  //@SANDARKAPAL
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSandarkapalSchema))
    data: UpdateSandarkapalDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      const sandarkapalExist = await isRecordExist(
        'nama',
        data.nama,
        'sandarkapal',
        Number(id),
      );

      if (sandarkapalExist) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: `Sandar kapal dengan nama ${data.nama} sudah ada`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.sandarkapalService.update(+id, data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error updating sandar kapal in controller:', error);
      // Ensure any other errors get caught and returned
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      // Generic error handling, if something unexpected happens
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to update sandarkapal',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  //@PELAYARAN
  async delete(@Param('id') id: string, @Req() req) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.sandarkapalService.delete(
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
      console.error('Error deleting sandar kapal in controller:', error);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete sandar kapal');
    }
  }
}
