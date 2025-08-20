import { Module } from '@nestjs/common';
import { LaporanjenisorderanService } from './laporanjenisorderan.service';
import { LaporanjenisorderanController } from './laporanjenisorderan.controller';
import { JenisOrderanModule } from '../jenisorderan/jenisorderan.module';

@Module({
  imports: [JenisOrderanModule],
  controllers: [LaporanjenisorderanController],
  providers: [LaporanjenisorderanService],
})
export class LaporanjenisorderanModule {}
