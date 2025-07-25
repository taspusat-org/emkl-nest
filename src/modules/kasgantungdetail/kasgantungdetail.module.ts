import { Module } from '@nestjs/common';
import { KasgantungdetailService } from './kasgantungdetail.service';
import { KasgantungdetailController } from './kasgantungdetail.controller';

@Module({
  controllers: [KasgantungdetailController],
  providers: [KasgantungdetailService],
})
export class KasgantungdetailModule {}
