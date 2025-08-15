import { Module } from '@nestjs/common';
import { KapalService } from './kapal.service';
import { KapalController } from './kapal.controller';
import { UtilsModule } from 'src/utils/utils.module';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [UtilsModule, RedisModule, AuthModule, LogtrailModule],
  controllers: [KapalController],
  providers: [KapalService],
})
export class KapalModule {}
