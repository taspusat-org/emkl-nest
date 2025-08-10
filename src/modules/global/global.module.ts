import { Module } from '@nestjs/common';
import { GlobalService } from './global.service';
import { GlobalController } from './global.controller';
import { UtilsModule } from 'src/utils/utils.module';
import { KasgantungheaderModule } from '../kasgantungheader/kasgantungheader.module';
import { KasgantungheaderService } from '../kasgantungheader/kasgantungheader.service';

@Module({
  imports: [UtilsModule, KasgantungheaderModule],
  controllers: [GlobalController],
  providers: [GlobalService, KasgantungheaderService],
})
export class GlobalModule {}
