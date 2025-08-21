import { Module } from '@nestjs/common';
import { LaporanDaftarblService } from './laporan-daftarbl.service';
import { LaporanDaftarblController } from './laporan-daftarbl.controller';
import { DaftarblModule } from '../daftarbl/daftarbl.module';

@Module({
  imports: [DaftarblModule],
  controllers: [LaporanDaftarblController],
  providers: [LaporanDaftarblService],
})
export class LaporanDaftarblModule {}
