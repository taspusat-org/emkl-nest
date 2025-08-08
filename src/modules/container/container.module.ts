import { Module } from '@nestjs/common';
import { ContainerService } from './container.service';
import { ContainerController } from './container.controller';

@Module({
  controllers: [ContainerController],
  providers: [ContainerService],
})
export class ContainerModule {}
