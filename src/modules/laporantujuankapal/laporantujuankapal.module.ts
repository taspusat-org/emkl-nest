import { Module } from '@nestjs/common';
import { LaporantujuankapalService } from './laporantujuankapal.service';
import { LaporantujuankapalController } from './laporantujuankapal.controller';

@Module({
  controllers: [LaporantujuankapalController],
  providers: [LaporantujuankapalService],
})
export class LaporantujuankapalModule {}
