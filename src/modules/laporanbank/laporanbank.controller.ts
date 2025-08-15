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
import { LaporanbankService } from './laporanbank.service';
import { CreateLaporanbankDto } from './dto/create-laporanbank.dto';
import { UpdateLaporanbankDto } from './dto/update-laporanbank.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { BankService } from '../bank/bank.service';
import * as fs from 'fs';
import { query, Response } from 'express';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';

@Controller('laporanbank')
export class LaporanbankController {
  constructor(
    private readonly laporanbankService: LaporanbankService,
    private readonly bankService: BankService,
  ) {}

  @Post()
  //@LAPORAN-BANK
  create(@Body() createLaporanbankDto: CreateLaporanbankDto) {
    return this.laporanbankService.create(createLaporanbankDto);
  }

  @Get()
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

      const result = await this.bankService.findAll(params, trx);

      await trx.commit();

      if (!Array.isArray(result.data)) {
        throw new Error('result.data is not an array or is undefined.');
      }

      const tempFilePath = await this.laporanbankService.exportToExcel(
        result.data,
      );
      const fileStream = fs.createReadStream(tempFilePath);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="laporan_bank.xlsx"',
      );

      fileStream.pipe(res);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).send('Failed to export file');
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.laporanbankService.findOne(+id);
  }

  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateLaporanbankDto: UpdateLaporanbankDto,
  // ) {
  //   return this.laporanbankService.update(+id, updateLaporanbankDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.laporanbankService.remove(+id);
  }
}
