import { Module } from '@nestjs/common';
import { PengeluaranheaderService } from './pengeluaranheader.service';
import { PengeluaranheaderController } from './pengeluaranheader.controller';
import { PengeluarandetailModule } from '../pengeluarandetail/pengeluarandetail.module';
import { UtilsModule } from 'src/utils/utils.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';
import { RunningNumberModule } from '../running-number/running-number.module';
import { GlobalModule } from '../global/global.module';
import { LocksModule } from '../locks/locks.module';

@Module({
  imports: [
    UtilsModule,
    RedisModule,
    AuthModule,
    LogtrailModule,
    RunningNumberModule,
    PengeluarandetailModule,
    GlobalModule,
    LocksModule,
  ],
  controllers: [PengeluaranheaderController],
  providers: [PengeluaranheaderService],
  exports: [PengeluaranheaderService],
})
export class PengeluaranheaderModule {}
