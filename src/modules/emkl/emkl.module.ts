import { Module } from '@nestjs/common';
import { EmklService } from './emkl.service';
import { EmklController } from './emkl.controller';

@Module({
  controllers: [EmklController],
  providers: [EmklService],
})
export class EmklModule {}
