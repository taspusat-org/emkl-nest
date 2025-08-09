import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
} from '@nestjs/common';
import { GlobalService } from './global.service';
import { CreateGlobalDto } from './dto/create-global.dto';
import { UpdateGlobalDto } from './dto/update-global.dto';
import { dbMssql } from 'src/common/utils/db';

@Controller('global')
export class GlobalController {
  constructor(private readonly globalService: GlobalService) {}

  // @Post()
  // create(@Body() createGlobalDto: CreateGlobalDto) {
  //   return this.globalService.create(createGlobalDto);
  // }
  @Post('delete-validation')
  async validateDelete(
    @Body() checks: { tableName: string; fieldName: string; fieldValue: any }[],
  ) {
    const trx = await dbMssql.transaction();

    // Deklarasikan tipe untuk validationResults
    const validationResults: {
      tableName: string;
      fieldName: string;
      fieldValue: any;
      status: string;
      message: string;
    }[] = []; // Array untuk menyimpan hasil validasi

    try {
      // Panggil service untuk melakukan validasi
      const result = await this.globalService.validationDelete(checks, trx);

      // Masukkan hasil validasi ke dalam validationResults
      validationResults.push(...result);

      // Komit transaksi meskipun ada pengecekan yang gagal
      await trx.commit();

      return {
        statusCode: HttpStatus.OK,
        message: 'Validation completed.',
        data: validationResults,
      };
    } catch (error) {
      // Rollback transaksi jika ada error
      await trx.rollback();
      console.error('Error during validation:', error);

      return {
        statusCode: HttpStatus.OK,
        message: 'Validation completed with errors.',
        data: validationResults,
      };
    }
  }

  @Get()
  findAll() {
    return this.globalService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.globalService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGlobalDto: UpdateGlobalDto) {
    return this.globalService.update(+id, updateGlobalDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.globalService.remove(+id);
  }
}
