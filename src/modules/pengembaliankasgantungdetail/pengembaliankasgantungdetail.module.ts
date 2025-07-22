import { Module } from '@nestjs/common';
import { PengembaliankasgantungdetailService } from './pengembaliankasgantungdetail.service';
import { PengembaliankasgantungdetailController } from './pengembaliankasgantungdetail.controller';

@Module({
  controllers: [PengembaliankasgantungdetailController],
  providers: [PengembaliankasgantungdetailService],
})
export class PengembaliankasgantungdetailModule {}
