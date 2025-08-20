import { Module } from '@nestjs/common';
import { AsalkapalService } from './asalkapal.service';
import { AsalkapalController } from './asalkapal.controller';
import { UtilsModule } from 'src/utils/utils.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';
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
  controllers: [AsalkapalController],
  providers: [AsalkapalService],
})
export class AsalkapalModule {}
