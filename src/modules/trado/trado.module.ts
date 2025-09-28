import { Module } from '@nestjs/common';
import { TradoService } from './trado.service';
import { TradoController } from './trado.controller';
import { UtilsModule } from 'src/utils/utils.module';

@Module({
  controllers: [TradoController],
  providers: [TradoService],
  imports: [UtilsModule],
})
export class TradoModule {}
