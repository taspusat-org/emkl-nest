import { Test, TestingModule } from '@nestjs/testing';
import { LaporanjenisorderanService } from './laporanjenisorderan.service';

describe('LaporanjenisorderanService', () => {
  let service: LaporanjenisorderanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LaporanjenisorderanService],
    }).compile();

    service = module.get<LaporanjenisorderanService>(
      LaporanjenisorderanService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
