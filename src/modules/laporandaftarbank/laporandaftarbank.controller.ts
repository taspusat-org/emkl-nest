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
import { LaporandaftarbankService } from './laporandaftarbank.service';
import { CreateLaporandaftarbankDto } from './dto/create-laporandaftarbank.dto';
import { UpdateLaporandaftarbankDto } from './dto/update-laporandaftarbank.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import * as fs from 'fs';
import { query, Response } from 'express';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { DaftarBankService } from '../daftarbank/daftarbank.service';

@Controller('laporandaftarbank')
export class LaporandaftarbankController {
  constructor(
    private readonly laporandaftarbankService: LaporandaftarbankService,
    private readonly daftarbankService: DaftarBankService,
  ) {}

  @Post()
  //@LAPORAN-DAFTAR-BANK
  create(@Body() createLaporandaftarbankDto: CreateLaporandaftarbankDto) {
    return this.laporandaftarbankService.create(createLaporandaftarbankDto);
  }

  @Get()
  //@LAPORAN-DAFTAR-BANK
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

      const result = await this.daftarbankService.findAll(params, trx);

      await trx.commit();

      if (!Array.isArray(result.data)) {
        throw new Error('result.data is not an array or is undefined.');
      }

      const tempFilePath = await this.laporandaftarbankService.exportToExcel(
        result.data,
      );
      const fileStream = fs.createReadStream(tempFilePath);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="laporan_daftarbank.xlsx"',
      );

      fileStream.pipe(res);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).send('Failed to export file');
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.laporandaftarbankService.findOne(+id);
  }

  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateLaporandaftarbankDto: UpdateLaporandaftarbankDto,
  // ) {
  //   return this.laporandaftarbankService.update(
  //     +id,
  //     updateLaporandaftarbankDto,
  //   );
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.laporandaftarbankService.remove(+id);
  }
}
