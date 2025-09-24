import { Module } from '@nestjs/common';
import { StatusjobService } from './statusjob.service';
import { StatusjobController } from './statusjob.controller';
import { UtilsModule } from 'src/utils/utils.module';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';

@Module({
  imports: [UtilsModule, LogtrailModule],
  controllers: [StatusjobController],
  providers: [StatusjobService],
  exports: [StatusjobService],
})
export class StatusjobModule {}
