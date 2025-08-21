import { Test, TestingModule } from '@nestjs/testing';
import { LaporanDaftarblService } from './laporan-daftarbl.service';

describe('LaporanDaftarblService', () => {
  let service: LaporanDaftarblService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LaporanDaftarblService],
    }).compile();

    service = module.get<LaporanDaftarblService>(LaporanDaftarblService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
