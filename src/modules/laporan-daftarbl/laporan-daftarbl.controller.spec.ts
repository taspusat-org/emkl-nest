import { Test, TestingModule } from '@nestjs/testing';
import { LaporanDaftarblController } from './laporan-daftarbl.controller';
import { LaporanDaftarblService } from './laporan-daftarbl.service';

describe('LaporanDaftarblController', () => {
  let controller: LaporanDaftarblController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaporanDaftarblController],
      providers: [LaporanDaftarblService],
    }).compile();

    controller = module.get<LaporanDaftarblController>(
      LaporanDaftarblController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
