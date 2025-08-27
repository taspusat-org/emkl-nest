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
import * as fs from 'fs';
import { Response } from 'express';
import { dbMssql } from 'src/common/utils/db';
import { AuthGuard } from '../auth/auth.guard';
import { isRecordExist } from 'src/utils/utils.service';
import { TypeAkuntansiService } from './type-akuntansi.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { KeyboardOnlyValidationPipe } from 'src/common/pipes/keyboardonly-validation.pipe';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import {
  CreateTypeAkuntansiDto,
  CreateTypeAkuntansiSchema,
  UpdateTypeAkuntansiDto,
  UpdateTypeAkuntansiSchema,
} from './dto/create-type-akuntansi.dto';
import { InjectMethodPipe } from 'src/common/pipes/inject-method.pipe';

@Controller('type-akuntansi')
export class TypeAkuntansiController {
  constructor(private readonly typeAkuntansiService: TypeAkuntansiService) {}

  @UseGuards(AuthGuard)
  @Post()
  //@TYPE-AKUNTANSI
  async create(
    @Body(
      new InjectMethodPipe('create'),
      new ZodValidationPipe(CreateTypeAkuntansiSchema),
    )
    data: CreateTypeAkuntansiDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.typeAkuntansiService.create(data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error while creating type akuntansi in controller', error);

      // Ensure any other errors get caught and returned
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

  @Get()
  //@TYPE-AKUNTANSI
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
      const result = await this.typeAkuntansiService.findAll(params, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error(
        'Error fetching all type akuntansi ini controller:',
        error,
        error.message,
      );
      throw new InternalServerErrorException('Failed to fetch type akuntansi');
    }
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  //@TYPE-AKUNTANSI
  async update(
    @Param('id') dataId: string,
    @Body(
      new InjectMethodPipe('update'),
      new ZodValidationPipe(UpdateTypeAkuntansiSchema),
    )
    data: UpdateTypeAkuntansiDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.typeAkuntansiService.update(+dataId, data, trx);

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
  //@TYPE-AKUNTANSI
  async delete(@Param('id') id: string, @Req() req) {
    const trx = await dbMssql.transaction();
    try {
      const result = await this.typeAkuntansiService.delete(
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
      console.error('Error deleting data in controller: ', error);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete data');
    }
  }

  @Post('check-validation')
  @UseGuards(AuthGuard)
  async checkValidasi(@Body() body: { aksi: string; value: any }, @Req() req) {
    const { aksi, value } = body;
    console.log('body', body);
    const trx = await dbMssql.transaction();
    const editedby = req.user?.user?.username;

    try {
      const forceEdit = await this.typeAkuntansiService.checkValidasi(
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

  // @Get('/export')
  // async exportToExcel(
  //   @Query() query: any,
  //   @Res() res: Response
  // ) {
  //   try {
  //     const { data } = await this.findAll(query);

  //     if (!Array.isArray(data)) {
  //       throw new Error('Data is not an array or is undefined')
  //     }

  //     const tempFilePath = await this.typeAkuntansiService.exportToExcel(data);
  //     const fileStream = fs.createReadStream(tempFilePath)

  //     res.setHeader(
  //       'Content-Type',
  //       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  //     )
  //     res.setHeader(
  //       'Content-Disposition',
  //       'attachment; filename="laporan_typeakuntansi.xlsx"'
  //     )

  //     fileStream.pipe(res)
  //   } catch (error) {
  //     console.error('Error exporting to Excel:', error);
  //     res.status(500).send('Failed to export file');
  //   }
  // }

  // @Post('/export-byselect')
  // async exportToExcelBySelect(
  //   @Body() ids: {id: number }[],
  //   @Res() res: Response
  // ) {
  //   try {
  //     const data = await this.typeAkuntansiService.findAllByIds(ids);

  //     if (!Array.isArray(data)) {
  //       throw new Error('Data is not an array or is undefined')
  //     }

  //     const tempFilePath = await this.typeAkuntansiService.exportToExcel(data);
  //     const fileStream = fs.createReadStream(tempFilePath);

  //     res.setHeader(
  //       'Content-Type',
  //       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  //     )
  //     res.setHeader(
  //       'Content-Disposition',
  //       'attachment; filename="laporan_typeakuntansi.xlsx"'
  //     )

  //     fileStream.pipe(res);
  //   } catch (error) {
  //     console.error('Error exporting to Excel:', error);
  //     res.status(500).send('Failed to export file');
  //   }
  // }

  // @Post('/report-byselect')
  // async findAllByIds(
  //   @Body() ids: { id: number }[]
  // ) {
  //   return this.typeAkuntansiService.findAllByIds(ids);
  // }
}
