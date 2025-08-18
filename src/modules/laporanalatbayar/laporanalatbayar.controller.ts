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
import { LaporanalatbayarService } from './laporanalatbayar.service';
import { CreateLaporanalatbayarDto } from './dto/create-laporanalatbayar.dto';
import { UpdateLaporanalatbayarDto } from './dto/update-laporanalatbayar.dto';
import * as fs from 'fs';
import { query, Response } from 'express';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { AlatbayarService } from '../alatbayar/alatbayar.service';

@Controller('laporanalatbayar')
export class LaporanalatbayarController {
  constructor(
    private readonly laporanalatbayarService: LaporanalatbayarService,
    private readonly AlatbayarService: AlatbayarService,
  ) {}

  @Post()
  //@LAPORAN-ALAT-BAYAR
  create(@Body() createLaporanalatbayarDto: CreateLaporanalatbayarDto) {
    return this.laporanalatbayarService.create(createLaporanalatbayarDto);
  }

  @Get()
  //@LAPORAN-ALAT-BAYAR
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

      const result = await this.AlatbayarService.findAll(params, trx);

      await trx.commit();

      if (!Array.isArray(result.data)) {
        throw new Error('result.data is not an array or is undefined.');
      }

      const tempFilePath = await this.laporanalatbayarService.exportToExcel(
        result.data,
      );
      const fileStream = fs.createReadStream(tempFilePath);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="laporan_alat_bayar.xlsx"',
      );

      fileStream.pipe(res);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).send('Failed to export file');
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.laporanalatbayarService.findOne(+id);
  }

  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateLaporanalatbayarDto: UpdateLaporanalatbayarDto,
  // ) {
  //   return this.laporanalatbayarService.update(+id, updateLaporanalatbayarDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.laporanalatbayarService.remove(+id);
  }
}
