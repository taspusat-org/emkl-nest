import { Test, TestingModule } from '@nestjs/testing';
import { LaporanbankService } from './laporanbank.service';

describe('LaporanbankService', () => {
  let service: LaporanbankService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LaporanbankService],
    }).compile();

    service = module.get<LaporanbankService>(LaporanbankService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
