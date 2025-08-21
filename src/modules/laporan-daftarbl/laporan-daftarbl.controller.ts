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
import { LaporanDaftarblService } from './laporan-daftarbl.service';
import { CreateLaporanDaftarblDto } from './dto/create-laporan-daftarbl.dto';
import { UpdateLaporanDaftarblDto } from './dto/update-laporan-daftarbl.dto';
import * as fs from 'fs';
import { query, Response } from 'express';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { DaftarblService } from '../daftarbl/daftarbl.service';

@Controller('laporan-daftarbl')
export class LaporanDaftarblController {
  constructor(
    private readonly laporanDaftarblService: LaporanDaftarblService,
    private readonly daftarblService: DaftarblService,
  ) {}

  @Post()
  //@LAPORAN-DAFTARBL
  create(@Body() createLaporanDaftarblDto: CreateLaporanDaftarblDto) {
    return this.laporanDaftarblService.create(createLaporanDaftarblDto);
  }

  @Get()
  //@LAPORAN-DAFTARBL
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

      const result = await this.daftarblService.findAll(params, trx);

      await trx.commit();

      if (!Array.isArray(result.data)) {
        throw new Error('result.data is not an array or is undefined.');
      }

      const tempFilePath = await this.laporanDaftarblService.exportToExcel(
        result.data,
      );
      const fileStream = fs.createReadStream(tempFilePath);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="laporan_daftarbl.xlsx"',
      );

      fileStream.pipe(res);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).send('Failed to export file');
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.laporanDaftarblService.findOne(+id);
  }

  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateLaporanDaftarblDto: UpdateLaporanDaftarblDto,
  // ) {
  //   return this.laporanDaftarblService.update(+id, updateLaporanDaftarblDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.laporanDaftarblService.remove(+id);
  }
}
