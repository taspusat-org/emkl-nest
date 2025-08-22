import { Module } from '@nestjs/common';
import { SandarkapalService } from './sandarkapal.service';
import { SandarkapalController } from './sandarkapal.controller';
import { RelasiModule } from '../relasi/relasi.module';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { UtilsModule } from 'src/utils/utils.module';
import { GlobalModule } from '../global/global.module';
import { LocksModule } from '../locks/locks.module';

@Module({
  imports: [
    UtilsModule,
    RedisModule,
    AuthModule,
    LogtrailModule,
    GlobalModule,
    LocksModule,
  ],
  controllers: [SandarkapalController],
  providers: [SandarkapalService],
})
export class SandarkapalModule {}
