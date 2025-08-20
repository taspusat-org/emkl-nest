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
import { LaporanhargatruckingService } from './laporanhargatrucking.service';
import { CreateLaporanhargatruckingDto } from './dto/create-laporanhargatrucking.dto';
import { UpdateLaporanhargatruckingDto } from './dto/update-laporanhargatrucking.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { HargatruckingService } from '../hargatrucking/hargatrucking.service';
import * as fs from 'fs';
import { Response } from 'express';
import { dbMssql } from 'src/common/utils/db';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';

@Controller('laporanhargatrucking')
export class LaporanhargatruckingController {
  constructor(
    private readonly laporanhargatruckingService: LaporanhargatruckingService,
    private readonly hargatruckingService: HargatruckingService,
  ) {}

  @Post()
  //@LAPORAN-HARGA-TRUCKING
  create(@Body() createLaporanhargatruckingDto: CreateLaporanhargatruckingDto) {
    return this.laporanhargatruckingService.create(
      createLaporanhargatruckingDto,
    );
  }

  @Get()
  //@LAPORAN-HARGA-TRUCKING
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

      const result = await this.hargatruckingService.findAll(params, trx);

      await trx.commit();

      if (!Array.isArray(result.data)) {
        throw new Error('result.data is not an array or is undefined.');
      }

      const tempFilePath = await this.laporanhargatruckingService.exportToExcel(
        result.data,
      );
      const fileStream = fs.createReadStream(tempFilePath);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="laporan_hargatrucking.xlsx"',
      );

      fileStream.pipe(res);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      res.status(500).send('Failed to export file');
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.laporanhargatruckingService.findOne(+id);
  }

  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateLaporanhargatruckingDto: UpdateLaporanhargatruckingDto,
  // ) {
  //   return this.laporanhargatruckingService.update(
  //     +id,
  //     updateLaporanhargatruckingDto,
  //   );
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.laporanhargatruckingService.remove(+id);
  }
}
