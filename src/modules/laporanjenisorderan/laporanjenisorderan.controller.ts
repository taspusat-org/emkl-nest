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
import { LaporanjenisorderanService } from './laporanjenisorderan.service';
import { CreateLaporanjenisorderanDto } from './dto/create-laporanjenisorderan.dto';
import { UpdateLaporanjenisorderanDto } from './dto/update-laporanjenisorderan.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import * as fs from 'fs';
import { Response } from 'express';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { JenisOrderanService } from '../jenisorderan/jenisorderan.service';

@Controller('laporanjenisorderan')
export class LaporanjenisorderanController {
  constructor(
    private readonly laporanjenisorderanService: LaporanjenisorderanService,
    private readonly jenisorderanService: JenisOrderanService,
  ) {}

  @Post()
  //@LAPORAN-JENIS-ORDERAN
  create(@Body() createLaporanjenisorderanDto: CreateLaporanjenisorderanDto) {
    return this.laporanjenisorderanService.create(createLaporanjenisorderanDto);
  }

  @Get()
  //@LAPORAN-JENIS-ORDERAN
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

      const result = await this.jenisorderanService.findAll(params, trx);

      await trx.commit();

      if (!Array.isArray(result.data)) {
        throw new Error('result.data is not an array or is undefined.');
      }

      const tempFilePath = await this.laporanjenisorderanService.exportToExcel(
        result.data,
      );
      const fileStream = fs.createReadStream(tempFilePath);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="laporan_jenisorderan.xlsx"',
      );

      fileStream.pipe(res);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).send('Failed to export file');
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.laporanjenisorderanService.findOne(+id);
  }

  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateLaporanjenisorderanDto: UpdateLaporanjenisorderanDto,
  // ) {
  //   return this.laporanjenisorderanService.update(
  //     +id,
  //     updateLaporanjenisorderanDto,
  //   );
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.laporanjenisorderanService.remove(+id);
  }
}
