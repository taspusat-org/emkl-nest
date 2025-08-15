import { Module } from '@nestjs/common';
import { LaporantujuankapalService } from './laporantujuankapal.service';
import { LaporantujuankapalController } from './laporantujuankapal.controller';
import { TujuankapalModule } from '../tujuankapal/tujuankapal.module';
@Module({
  imports: [TujuankapalModule],
  controllers: [LaporantujuankapalController],
  providers: [LaporantujuankapalService],
})
export class LaporantujuankapalModule {}
