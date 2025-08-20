import { Module } from '@nestjs/common';
import { LaporanjenismuatanService } from './laporanjenismuatan.service';
import { LaporanjenismuatanController } from './laporanjenismuatan.controller';
import { JenisMuatanModule } from '../jenismuatan/jenismuatan.module';

@Module({
  imports: [JenisMuatanModule],
  controllers: [LaporanjenismuatanController],
  providers: [LaporanjenismuatanService],
})
export class LaporanjenismuatanModule {}
