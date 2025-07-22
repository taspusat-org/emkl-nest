import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PengembaliankasgantungheaderService } from './pengembaliankasgantungheader.service';
import { CreatePengembaliankasgantungheaderDto } from './dto/create-pengembaliankasgantungheader.dto';
import { UpdatePengembaliankasgantungheaderDto } from './dto/update-pengembaliankasgantungheader.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { dbMssql } from 'src/common/utils/db';
import { AuthGuard } from '../auth/auth.guard';

@Controller('pengembaliankasgantungheader')
export class PengembaliankasgantungheaderController {
  constructor(
    private readonly pengembaliankasgantungheaderService: PengembaliankasgantungheaderService,
  ) {}

  @UseGuards(AuthGuard)
  @Post()
  async create(
    @Body()
    data: any,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.pengembaliankasgantungheaderService.create(
        data,
        trx,
      );

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new Error(`Error creating menu: ${error.message}`);
    }
  }
  @Get()
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: FindAllDto) {
    const trx = await dbMssql.transaction();
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

      const result = this.pengembaliankasgantungheaderService.findAll(
        params,
        trx,
      );
      trx.commit();

      return result;
    } catch (error) {
      await trx.rollback();
      console.error('Error in findAll:', error);
      throw error; // Re-throw the error to be handled by the global exception filter
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pengembaliankasgantungheaderService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    updatePengembaliankasgantungheaderDto: UpdatePengembaliankasgantungheaderDto,
  ) {
    return this.pengembaliankasgantungheaderService.update(
      +id,
      updatePengembaliankasgantungheaderDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pengembaliankasgantungheaderService.remove(+id);
  }
}
