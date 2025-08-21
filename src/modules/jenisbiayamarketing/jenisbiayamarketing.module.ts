import { Module } from '@nestjs/common';
import { JenisbiayamarketingService } from './jenisbiayamarketing.service';
import { JenisbiayamarketingController } from './jenisbiayamarketing.controller';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { UtilsModule } from 'src/utils/utils.module';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';

@Module({
  imports: [AuthModule, RedisModule, UtilsModule, LogtrailModule],
  controllers: [JenisbiayamarketingController],
  providers: [JenisbiayamarketingService],
})
export class JenisbiayamarketingModule {}
