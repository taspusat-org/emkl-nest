import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UsePipes,
  UseGuards,
  Req,
  Put,
  InternalServerErrorException,
} from '@nestjs/common';
import { KasgantungheaderService } from './kasgantungheader.service';
import { CreateKasgantungheaderDto } from './dto/create-kasgantungheader.dto';
import { UpdateKasgantungheaderDto } from './dto/update-kasgantungheader.dto';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { dbMssql } from 'src/common/utils/db';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';

@Controller('kasgantungheader')
export class KasgantungheaderController {
  constructor(
    private readonly kasgantungheaderService: KasgantungheaderService,
  ) {}

  @UseGuards(AuthGuard)
  @Post()
  //@KAS-GANTUNG
  async create(
    @Body()
    data: any,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.kasgantungheaderService.create(data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Error: ${error.message}`);
    }
  }
  @UseGuards(AuthGuard)
  @Get()
  //@KAS-GANTUNG
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: FindAllDto) {
    const { search, page, limit, sortBy, sortDirection, isLookUp, ...filters } =
      query;

    const sortParams = {
      sortBy: sortBy || 'nobukti',
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

    try {
      const result = await this.kasgantungheaderService.findAll(params, trx);
      trx.commit();

      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error in findAll:', error);
      throw error; // Re-throw the error to be handled by the global exception filter
    }
  }
  @Get('list')
  //@KAS-GANTUNG
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAllKasgantung(@Query() query: { dari: string; sampai: string }) {
    const { dari, sampai } = query;
    const trx = await dbMssql.transaction();

    try {
      const result = await this.kasgantungheaderService.getKasGantung(
        dari,
        sampai,
        trx,
      );
      trx.commit();

      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error in findAll:', error);
      throw error; // Re-throw the error to be handled by the global exception filter
    }
  }
  @Get('pengembalian')
  //@KAS-GANTUNG
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAllPengembalian(
    @Query() query: { id: any; dari: string; sampai: string },
  ) {
    const { dari, sampai, id } = query;
    const trx = await dbMssql.transaction();

    try {
      const result = await this.kasgantungheaderService.getPengembalian(
        id,
        dari,
        sampai,
        trx,
      );
      trx.commit();

      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error in findAll:', error);
      throw error; // Re-throw the error to be handled by the global exception filter
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.kasgantungheaderService.findOne(+id);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any, @Req() req) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';
      console.log('data', data);
      const result = await this.kasgantungheaderService.update(+id, data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error updating menu in controller:', error);
      throw new Error('Failed to update menu');
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req) {
    const trx = await dbMssql.transaction();
    const modifiedby = req.user?.user?.username || 'unknown';
    try {
      const result = await this.kasgantungheaderService.delete(
        +id,
        trx,
        modifiedby,
      );

      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error deleting pengembaliankasgantungheader:', error);
      throw new Error(
        `Error deleting pengembaliankasgantungheader: ${error.message}`,
      );
    }
  }
  @Post('check-validation')
  @UseGuards(AuthGuard)
  async checkValidasi(@Body() body: { aksi: string; value: any }, @Req() req) {
    const { aksi, value } = body;
    console.log('body', body);
    const trx = await dbMssql.transaction();
    const editedby = req.user?.user?.username;
    try {
      const forceEdit = await this.kasgantungheaderService.checkValidasi(
        aksi,
        value,
        editedby,
        trx,
      );
      trx.commit();
      return forceEdit;
    } catch (error) {
      trx.rollback();
      console.error('Error checking validation:', error);
      throw new InternalServerErrorException('Failed to check validation');
    }
  }
}
