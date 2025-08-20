import { Module } from '@nestjs/common';
import { LaporandaftarbankService } from './laporandaftarbank.service';
import { LaporandaftarbankController } from './laporandaftarbank.controller';
import { DaftarBankModule } from '../daftarbank/daftarbank.module';

@Module({
  imports: [DaftarBankModule],
  controllers: [LaporandaftarbankController],
  providers: [LaporandaftarbankService],
})
export class LaporandaftarbankModule {}
