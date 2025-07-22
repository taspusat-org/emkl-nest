import { Module } from '@nestjs/common';
import { PengembaliankasgantungheaderService } from './pengembaliankasgantungheader.service';
import { PengembaliankasgantungheaderController } from './pengembaliankasgantungheader.controller';
import { UtilsModule } from 'src/utils/utils.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';

@Module({
  imports: [UtilsModule, RedisModule, AuthModule, LogtrailModule],
  controllers: [PengembaliankasgantungheaderController],
  providers: [PengembaliankasgantungheaderService],
})
export class PengembaliankasgantungheaderModule {}
