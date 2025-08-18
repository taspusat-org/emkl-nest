import { Module } from '@nestjs/common';
import { LaporanalatbayarService } from './laporanalatbayar.service';
import { LaporanalatbayarController } from './laporanalatbayar.controller';
import { AlatbayarModule } from '../alatbayar/alatbayar.module';
@Module({
  imports: [AlatbayarModule],
  controllers: [LaporanalatbayarController],
  providers: [LaporanalatbayarService],
})
export class LaporanalatbayarModule {}
