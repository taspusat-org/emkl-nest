import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { MailModule } from './common/mail/mail.module';
import { ConfigModule } from '@nestjs/config';
import { AuthMiddleware } from './common/middlewares/auth.middleware';
import { UtilsModule } from './utils/utils.module';
import { RedisModule } from './common/redis/redis.module';
import { RedisController } from './common/redis/redis.controller';
import { SocketModule } from './common/socket/socket.module';
import { AcosModule } from './modules/acos/acos.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { ErrorModule } from './modules/error/error.module';
import { ParameterModule } from './modules/parameter/parameter.module';
import { RedisService } from './common/redis/redis.service';
import { LogtrailModule } from './common/logtrail/logtrail.module';
import { MenuModule } from './modules/menu/menu.module';
import { RoleModule } from './modules/role/role.module';
import { UserModule } from './modules/user/user.module';
import { OffdaysModule } from './modules/offdays/offdays.module';
import { RoleaclModule } from './modules/roleacl/roleacl.module';
import { UseraclModule } from './modules/useracl/useracl.module';
import { UserroleModule } from './modules/userrole/userrole.module';
import { CacheModule } from '@nestjs/cache-manager';
import { RunningNumberModule } from './modules/running-number/running-number.module';
import { KnexModule } from './modules/knex/knex.module';
import { FieldlengthModule } from './modules/fieldlength/fieldlength.module';
import { CabangModule } from './modules/cabang/cabang.module';
import { RabbitmqModule } from './modules/rabbitmq/rabbitmq.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RabbitmqService } from './modules/rabbitmq/rabbitmq.service';
import { RabbitmqClientModule } from './modules/rabbitmq-client/rabbitmq-client.module';
import { BotModule } from './modules/bot/bot.module';
import { PengembaliankasgantungheaderModule } from './modules/pengembaliankasgantungheader/pengembaliankasgantungheader.module';
import { PengembaliankasgantungdetailModule } from './modules/pengembaliankasgantungdetail/pengembaliankasgantungdetail.module';
import { KasgantungheaderModule } from './modules/kasgantungheader/kasgantungheader.module';
import { KasgantungdetailModule } from './modules/kasgantungdetail/kasgantungdetail.module';
import { RelasiModule } from './modules/relasi/relasi.module';
import { AlatbayarModule } from './modules/alatbayar/alatbayar.module';
import { BankModule } from './modules/bank/bank.module';
import { SseModule } from './modules/sse/sse.module';

@Module({
  imports: [
    CacheModule.register(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    MailModule,
    AcosModule,
    ErrorModule,
    ParameterModule,
    UtilsModule,
    RedisModule,
    LogtrailModule,
    SocketModule,
    MenuModule,
    RoleModule,
    UserModule,
    OffdaysModule,
    RoleaclModule,
    UseraclModule,
    KnexModule,
    UserroleModule,
    RunningNumberModule,
    FieldlengthModule,
    CabangModule,
    RabbitmqModule,
    RabbitmqClientModule,
    BotModule,
    PengembaliankasgantungheaderModule,
    PengembaliankasgantungdetailModule,
    KasgantungheaderModule,
    KasgantungdetailModule,
    RelasiModule,
    AlatbayarModule,
    BankModule,
    SseModule,
  ],
  controllers: [],
  providers: [RabbitmqService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        'auth/{*splat}',
        'menu/*',
        'offdays/*',
        'redis/*path',
        'uploads/*',
        'offdays/*',
        'sse/*',
      )
      .forRoutes('*');
  }
}
