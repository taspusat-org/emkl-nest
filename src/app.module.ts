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
import { ContainerModule } from './modules/container/container.module';
import { PelayaranModule } from './modules/pelayaran/pelayaran.module';
import { JenisMuatanModule } from './modules/jenismuatan/jenismuatan.module';

import { AkuntansiModule } from './modules/akuntansi/akuntansi.module';
import { GlobalModule } from './modules/global/global.module';
import { AkunpusatModule } from './modules/akunpusat/akunpusat.module';
import { KapalModule } from './modules/kapal/kapal.module';
import { TypeAkuntansiModule } from './modules/type-akuntansi/type-akuntansi.module';
import { ScheduleHeaderModule } from './modules/schedule-header/schedule-header.module';
import { ScheduleDetailModule } from './modules/schedule-detail/schedule-detail.module';
import { JenisOrderanModule } from './modules/jenisorderan/jenisorderan.module';
import { DaftarBankModule } from './modules/daftarbank/daftarbank.module';

import { TujuankapalModule } from './modules/tujuankapal/tujuankapal.module';
import { LocksModule } from './modules/locks/locks.module';
import { LaporanbankModule } from './modules/laporanbank/laporanbank.module';
import { LaporancontainerModule } from './modules/laporancontainer/laporancontainer.module';
import { LaporantujuankapalModule } from './modules/laporantujuankapal/laporantujuankapal.module';
import { HargatruckingModule } from './modules/hargatrucking/hargatrucking.module';
import { LaporanhargatruckingModule } from './modules/laporanhargatrucking/laporanhargatrucking.module';
import { EmklModule } from './modules/emkl/emkl.module';
import { LaporanalatbayarModule } from './modules/laporanalatbayar/laporanalatbayar.module';
<<<<<<< Updated upstream
import { ScheduleKapalModule } from './modules/schedule-kapal/schedule-kapal.module';
=======
import { LaporandaftarbankModule } from './modules/laporandaftarbank/laporandaftarbank.module';
import { LaporanjenisorderanModule } from './modules/laporanjenisorderan/laporanjenisorderan.module';
import { LaporanjenismuatanModule } from './modules/laporanjenismuatan/laporanjenismuatan.module';
>>>>>>> Stashed changes

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
    ContainerModule,

    AkunpusatModule,
    GlobalModule,
    PelayaranModule,
    JenisMuatanModule,
    AkuntansiModule,
    KapalModule,
    TypeAkuntansiModule,
    ScheduleHeaderModule,
    ScheduleDetailModule,
    JenisOrderanModule,
    DaftarBankModule,
    TujuankapalModule,
    LocksModule,
    LaporanbankModule,
    LaporancontainerModule,
    LaporantujuankapalModule,
    HargatruckingModule,
    LaporanhargatruckingModule,
    EmklModule,
    LaporanalatbayarModule,
<<<<<<< Updated upstream
    ScheduleKapalModule,
=======
    LaporandaftarbankModule,
    LaporanjenisorderanModule,
    LaporanjenismuatanModule,
>>>>>>> Stashed changes
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
