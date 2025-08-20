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
import { LaporancontainerService } from './laporancontainer.service';
import { CreateLaporancontainerDto } from './dto/create-laporancontainer.dto';
import { UpdateLaporancontainerDto } from './dto/update-laporancontainer.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { ContainerService } from '../container/container.service';
import * as fs from 'fs';
import { Response } from 'express';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';

@Controller('laporancontainer')
export class LaporancontainerController {
  constructor(
    private readonly laporancontainerService: LaporancontainerService,
    private readonly containerService: ContainerService,
  ) {}

  @Post()
  //@LAPORAN-CONTAINER
  create(@Body() createLaporancontainerDto: CreateLaporancontainerDto) {
    return this.laporancontainerService.create(createLaporancontainerDto);
  }

  @Get()
  //@LAPORAN-CONTAINER
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

      const result = await this.containerService.findAll(params, trx);

      await trx.commit();

      if (!Array.isArray(result.data)) {
        throw new Error('result.data is not an array or is undefined.');
      }

      const tempFilePath = await this.laporancontainerService.exportToExcel(
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
    return this.laporancontainerService.findOne(+id);
  }

  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateLaporancontainerDto: UpdateLaporancontainerDto,
  // ) {
  //   return this.laporancontainerService.update(+id, updateLaporancontainerDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.laporancontainerService.remove(+id);
  }
}
