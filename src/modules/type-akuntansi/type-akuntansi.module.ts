import { Module } from '@nestjs/common';
import { TypeAkuntansiService } from './type-akuntansi.service';
import { TypeAkuntansiController } from './type-akuntansi.controller';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { UtilsModule } from 'src/utils/utils.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    RedisModule, 
    UtilsModule, 
    AuthModule, 
    LogtrailModule
  ],
  controllers: [TypeAkuntansiController],
  providers: [TypeAkuntansiService],
})

export class TypeAkuntansiModule {}
