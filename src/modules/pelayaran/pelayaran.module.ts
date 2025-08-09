import { Module } from '@nestjs/common';
import { PelayaranService } from './pelayaran.service';
import { PelayaranController } from './pelayaran.controller';
import { UtilsModule } from 'src/utils/utils.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';
import { AuthModule } from '../auth/auth.module';
import { RelasiModule } from '../relasi/relasi.module';

@Module({
  imports: [RedisModule, UtilsModule, AuthModule, LogtrailModule, RelasiModule],
  controllers: [PelayaranController],
  providers: [PelayaranService],
})
export class PelayaranModule {}
