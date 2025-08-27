import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  UsePipes,
  Query,
  NotFoundException,
  InternalServerErrorException,
  Res,
} from '@nestjs/common';
import { HargatruckingService } from './hargatrucking.service';
import {
  CreateHargatruckingDto,
  CreateHargatruckingSchema,
} from './dto/create-hargatrucking.dto';
import {
  UpdateHargatruckingDto,
  UpdateHargatruckingSchema,
} from './dto/update-hargatrucking.dto';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { KeyboardOnlyValidationPipe } from 'src/common/pipes/keyboardonly-validation.pipe';
import { isRecordExist } from 'src/utils/utils.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { dbMssql } from 'src/common/utils/db';
import { any } from 'zod';
import { Response } from 'express';
import * as fs from 'fs';

@Controller('hargatrucking')
export class HargatruckingController {
  constructor(private readonly hargatruckingService: HargatruckingService) {}

  @Post()
  //@HARGA-TRUCKING
  async create(
    @Body(
      new ZodValidationPipe(CreateHargatruckingSchema),
      KeyboardOnlyValidationPipe,
    )
    data: CreateHargatruckingDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.hargatruckingService.create(data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error while creating harga trucking in controller', error);

      // Ensure any other errors get caught and returned
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      // Generic error handling, if something unexpected happens
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to create harga trucking',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  //@HARGA-TRUCKING
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: FindAllDto) {
    const { search, page, limit, sortBy, sortDirection, isLookUp, ...filters } =
      query;

    const sortParams = {
      sortBy: sortBy || 'emkl_text',
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
      const result = await this.hargatruckingService.findAll(params, trx);
      trx.commit();

      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error in findAll:', error);
      throw error; // Re-throw the error to be handled by the global exception filter
    }
  }

  @UseGuards(AuthGuard)
  @Put('update/:id')
  //@HARGA-TRUCKING
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateHargatruckingSchema))
    data: UpdateHargatruckingDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.hargatruckingService.update(+id, data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error updating Bank in controller:', error);
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      // Generic error handling, if something unexpected happens
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to create type akuntansi',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  //@HARGA-TRUCKING
  async delete(@Param('id') id: string, @Req() req) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.hargatruckingService.delete(
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
      console.error('Error deleting harga trucking in controller:', error);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete bank');
    }
  }
  @Get('/export')
  async exportToExcel(@Query() params: any, @Res() res: Response) {
    try {
      const { data } = await this.findAll(params);

      if (!Array.isArray(data)) {
        throw new Error('Data is not an array or is undefined.');
      }

      const tempFilePath = await this.hargatruckingService.exportToExcel(data);

      const fileStream = fs.createReadStream(tempFilePath);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="laporan_harga_trucking.xlsx"',
      );

      fileStream.pipe(res);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).send('Failed to export file');
    }
  }
}
