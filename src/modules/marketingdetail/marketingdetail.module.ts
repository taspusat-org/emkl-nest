import { Module } from '@nestjs/common';
import { MarketingdetailService } from './marketingdetail.service';
import { MarketingdetailController } from './marketingdetail.controller';
import { UtilsModule } from 'src/utils/utils.module';
import { LogtrailModule } from 'src/common/logtrail/logtrail.module';

@Module({
  controllers: [MarketingdetailController],
  providers: [MarketingdetailService],
  imports: [
    UtilsModule,
    LogtrailModule
  ],
  exports: [
    MarketingdetailService
  ]
})
export class MarketingdetailModule {}
