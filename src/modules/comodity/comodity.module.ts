import { Module } from '@nestjs/common';
import { ComodityService } from './comodity.service';
import { ComodityController } from './comodity.controller';
import { UtilsModule } from 'src/utils/utils.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';
import { LocksModule } from '../locks/locks.module';
import { GlobalModule } from '../global/global.module';

@Module({
  imports: [
    UtilsModule,
    RedisModule,
    AuthModule,
    LogtrailModule,
    GlobalModule,
    LocksModule,
  ],
  controllers: [ComodityController],
  providers: [ComodityService],
  exports: [ComodityService],
})
export class ComodityModule {}
