import { Module } from '@nestjs/common';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';
import { HttpModule } from '@nestjs/axios';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [HttpModule, BotModule],
  controllers: [SseController],
  providers: [SseService],
})
export class SseModule {}
