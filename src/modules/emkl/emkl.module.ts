import { Module } from '@nestjs/common';
import { EmklService } from './emkl.service';
import { EmklController } from './emkl.controller';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { UtilsModule } from 'src/utils/utils.module';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';
import { RelasiModule } from '../relasi/relasi.module';

@Module({
  imports: [AuthModule, RedisModule, UtilsModule, LogtrailModule, RelasiModule],
  controllers: [EmklController],
  providers: [EmklService],
})
export class EmklModule {}
