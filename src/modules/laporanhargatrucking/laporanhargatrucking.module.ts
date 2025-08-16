import { Module } from '@nestjs/common';
import { LaporanhargatruckingService } from './laporanhargatrucking.service';
import { LaporanhargatruckingController } from './laporanhargatrucking.controller';
import { HargatruckingModule } from '../hargatrucking/hargatrucking.module';

@Module({
  imports: [HargatruckingModule],
  controllers: [LaporanhargatruckingController],
  providers: [LaporanhargatruckingService],
})
export class LaporanhargatruckingModule {}
