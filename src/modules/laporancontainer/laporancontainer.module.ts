import { Module } from '@nestjs/common';
import { LaporancontainerService } from './laporancontainer.service';
import { LaporancontainerController } from './laporancontainer.controller';
import { ContainerModule } from '../container/container.module';

@Module({
  imports: [ContainerModule],
  controllers: [LaporancontainerController],
  providers: [LaporancontainerService],
})
export class LaporancontainerModule {}
