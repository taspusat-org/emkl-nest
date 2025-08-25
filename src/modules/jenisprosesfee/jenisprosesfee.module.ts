import { Module } from '@nestjs/common';
import { JenisprosesfeeService } from './jenisprosesfee.service';
import { JenisprosesfeeController } from './jenisprosesfee.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [JenisprosesfeeController],
  providers: [JenisprosesfeeService],
  imports: [
    AuthModule
  ]
})
export class JenisprosesfeeModule {}
