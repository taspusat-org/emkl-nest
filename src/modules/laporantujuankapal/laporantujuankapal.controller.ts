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
import { LaporantujuankapalService } from './laporantujuankapal.service';
import { CreateLaporantujuankapalDto } from './dto/create-laporantujuankapal.dto';
import { UpdateLaporantujuankapalDto } from './dto/update-laporantujuankapal.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { TujuankapalService } from '../tujuankapal/tujuankapal.service';
import * as fs from 'fs';
import { query, Response } from 'express';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';

@Controller('laporantujuankapal')
export class LaporantujuankapalController {
  constructor(
    private readonly laporantujuankapalService: LaporantujuankapalService,
    private readonly tujuankapalService: TujuankapalService,
  ) {}

  @Post()
  //@LAPORAN-TUJUAN-KAPAL
  create(@Body() createLaporantujuankapalDto: CreateLaporantujuankapalDto) {
    return this.laporantujuankapalService.create(createLaporantujuankapalDto);
  }

  @Get()
  //@LAPORAN-TUJUAN-KAPAL
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: FindAllDto, @Res() res: Response) {
    try {
      const {
        search,
        page,
        limit,
        sortBy,
        sortDirection,
        isLookUp,
        ...filters
      } = query;

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

      const result = await this.tujuankapalService.findAll(params, trx);

      await trx.commit();

      if (!Array.isArray(result.data)) {
        throw new Error('result.data is not an array or is undefined.');
      }

      const tempFilePath = await this.laporantujuankapalService.exportToExcel(
        result.data,
      );
      const fileStream = fs.createReadStream(tempFilePath);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="laporan_tujuankapal.xlsx"',
      );

      fileStream.pipe(res);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).send('Failed to export file');
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.laporantujuankapalService.findOne(+id);
  }

  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateLaporantujuankapalDto: UpdateLaporantujuankapalDto,
  // ) {
  //   return this.laporantujuankapalService.update(
  //     +id,
  //     updateLaporantujuankapalDto,
  //   );
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.laporantujuankapalService.remove(+id);
  }
}
