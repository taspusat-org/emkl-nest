import {
  Res,
  Get,
  Put,
  Req,
  Post,
  Body,
  Param,
  Query,
  Delete,
  UsePipes,
  UseGuards,
  HttpStatus,
  Controller,
  HttpException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { OrderanHeaderService } from './orderan-header.service';
import { CreateOrderanHeaderDto } from './dto/create-orderan-header.dto';
import { UpdateOrderanHeaderDto } from './dto/update-orderan-header.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { FindAllSchema } from 'src/common/interfaces/all.interface';
import { dbMssql } from 'src/common/utils/db';
import { OrderanMuatanService } from './orderan-muatan.service';

@Controller('orderanheader')
export class OrderanHeaderController {
  constructor(
    private readonly orderanHeaderService: OrderanHeaderService,
    private readonly orderanMuatanService: OrderanMuatanService
  ) {}

  @Post()
  create(@Body() createOrderanHeaderDto: CreateOrderanHeaderDto) {
    return this.orderanHeaderService.create(createOrderanHeaderDto);
  }

  @Get()
  //@ORDERANMUATAN
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: any) {
    const {
      search,
      page,
      limit,
      sortBy,
      sortDirection,
      isLookUp,
      jenisOrderan,
      ...filters
    } = query;
    let service: any;
    console.log('CON OR MU', query);
    

    const sortParams = {
      sortBy: sortBy || 'nobukti',
      sortDirection: sortDirection || 'asc',
    };

    const pagination = {
      page: page || 1,
      limit: limit === 0 || !limit ? undefined : limit,
    };

    const params = {
      search,
      filters,
      pagination,
      isLookUp: isLookUp === 'true',
      sort: sortParams as { sortBy: string; sortDirection: 'asc' | 'desc' },
    };

    const trx = await dbMssql.transaction();
    try {
      const getJenisOrderanMuatan = await trx('jenisorderan')
        .select('id')
        .where('nama', 'MUATAN')
        .first();
      const getJenisOrderanBongkaran = await trx('jenisorderan')
        .select('id')
        .where('nama', 'BONGKARAN')
        .first();
      const getJenisOrderanImport = await trx('jenisorderan')
        .select('id')
        .where('nama', 'IMPORT')
        .first();
      const getJenisOrderanExport = await trx('jenisorderan')
        .select('id')
        .where('nama', 'EKSPORT')
        .first();
      console.log(
        'getJenisOrderanMuatan',
        getJenisOrderanMuatan,
        getJenisOrderanMuatan.id,
      );

      switch (jenisOrderan) {
        case getJenisOrderanMuatan?.id:
          service = this.orderanMuatanService;
          break;
        // case 'IMPORT':
        //   service = this.hitungmodalimportService;
        //   break;
        // case 'EXPORT':
        //   service = this.hitungmodalexportService;
        //   break;
        default:
          service = this.orderanMuatanService;
          break;
      }
      const result = await service.findAll(params, trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error(
        'Error fetching all booking orderan header ini controller:',
        error,
        error.message,
      );
      throw new InternalServerErrorException(
        'Failed to fetch booking orderan header',
      );
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderanHeaderService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateOrderanHeaderDto: UpdateOrderanHeaderDto) {
    return this.orderanHeaderService.update(+id, updateOrderanHeaderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orderanHeaderService.remove(+id);
  }
}
