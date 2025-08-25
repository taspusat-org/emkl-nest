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
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ManagermarketingheaderService } from './managermarketingheader.service';
import {
  CreateManagermarketingHeaderDto,
  CreateManagermarketingHeaderSchema,
} from './dto/create-managermarketingheader.dto';
import { UpdateManagermarketingheaderDto } from './dto/update-managermarketingheader.dto';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { dbMssql } from 'src/common/utils/db';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { KeyboardOnlyValidationPipe } from 'src/common/pipes/keyboardonly-validation.pipe';
@Controller('managermarketing')
export class ManagermarketingheaderController {
  constructor(
    private readonly managermarketingheaderService: ManagermarketingheaderService,
  ) {}

  @UseGuards(AuthGuard)
  @Post()
  //@MANAGER-MARKETING
  async create(
    @Body(
      new ZodValidationPipe(CreateManagermarketingHeaderSchema),
      KeyboardOnlyValidationPipe,
    )
    data: CreateManagermarketingHeaderDto,
    @Req() req,
  ) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';

      const result = await this.managermarketingheaderService.create(data, trx);

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      // Generic error handling, if something unexpected happens
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to create manager marketing',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get()
  //@MANAGER-MARKETING
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: FindAllDto) {
    const { search, page, limit, sortBy, sortDirection, isLookUp, ...filters } =
      query;

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

    try {
      const result = await this.managermarketingheaderService.findAll(
        params,
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

  @UseGuards(AuthGuard)
  @Put(':id')
  //@MANAGER-MARKETING
  async update(@Param('id') id: string, @Body() data: any, @Req() req) {
    const trx = await dbMssql.transaction();
    try {
      data.modifiedby = req.user?.user?.username || 'unknown';
      const result = await this.managermarketingheaderService.update(
        +id,
        data,
        trx,
      );

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      if (error instanceof HttpException) {
        throw error; // If it's already a HttpException, rethrow it
      }

      // Generic error handling, if something unexpected happens
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to update manager marketing',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  //@MANAGER-MARKETING
  async delete(@Param('id') id: string, @Req() req) {
    const trx = await dbMssql.transaction();
    const modifiedby = req.user?.user?.username || 'unknown';
    try {
      const result = await this.managermarketingheaderService.delete(
        +id,
        trx,
        modifiedby,
      );

      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error deleting manager marketing header:', error);
      throw new Error(
        `Error deleting manager marketing header: ${error.message}`,
      );
    }
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.managermarketingheaderService.findOne(+id);
  }
}
