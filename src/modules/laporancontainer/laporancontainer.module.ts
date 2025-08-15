import { Module } from '@nestjs/common';
import { LaporancontainerService } from './laporancontainer.service';
import { LaporancontainerController } from './laporancontainer.controller';

@Module({
  controllers: [LaporancontainerController],
  providers: [LaporancontainerService],
})
export class LaporancontainerModule {}
