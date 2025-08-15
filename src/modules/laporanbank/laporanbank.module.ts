import { Module } from '@nestjs/common';
import { LaporanbankService } from './laporanbank.service';
import { LaporanbankController } from './laporanbank.controller';
import { BankModule } from '../bank/bank.module';

@Module({
  imports: [BankModule],
  controllers: [LaporanbankController],
  providers: [LaporanbankService],
})
export class LaporanbankModule {}
