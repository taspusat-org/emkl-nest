import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  UsePipes,
} from '@nestjs/common';
import { LaporanjenismuatanService } from './laporanjenismuatan.service';
import { CreateLaporanjenismuatanDto } from './dto/create-laporanjenismuatan.dto';
import { UpdateLaporanjenismuatanDto } from './dto/update-laporanjenismuatan.dto';
import { JenisMuatanService } from '../jenismuatan/jenismuatan.service';
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

@Controller('a')
export class LaporanjenismuatanController {
  constructor(
    private readonly laporanjenismuatanService: LaporanjenismuatanService,
    private readonly jenismuatanService: JenisMuatanService,
  ) {}

  @Post()
  //@LAPORAN-JENIS-MUATAN
  create(@Body() createLaporanjenismuatanDto: CreateLaporanjenismuatanDto) {
    return this.laporanjenismuatanService.create(createLaporanjenismuatanDto);
  }

  @Get()
  //@LAPORAN-JENIS-MUATAN
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

      const result = await this.jenismuatanService.findAll(params, trx);

      await trx.commit();

      if (!Array.isArray(result.data)) {
        throw new Error('result.data is not an array or is undefined.');
      }

      const tempFilePath = await this.laporanjenismuatanService.exportToExcel(
        result.data,
      );
      const fileStream = fs.createReadStream(tempFilePath);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="laporan_jenismuatan.xlsx"',
      );

      fileStream.pipe(res);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).send('Failed to export file');
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.laporanjenismuatanService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLaporanjenismuatanDto: UpdateLaporanjenismuatanDto,
  ) {
    return this.laporanjenismuatanService.update(
      +id,
      updateLaporanjenismuatanDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.laporanjenismuatanService.remove(+id);
  }
}
