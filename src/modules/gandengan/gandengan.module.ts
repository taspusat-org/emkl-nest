import { Module } from '@nestjs/common';
import { GandenganService } from './gandengan.service';
import { GandenganController } from './gandengan.controller';
import { UtilsModule } from 'src/utils/utils.module';

@Module({
  controllers: [GandenganController],
  providers: [GandenganService],
  imports: [
    UtilsModule,
  ],
})
export class GandenganModule {}
