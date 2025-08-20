import { Test, TestingModule } from '@nestjs/testing';
import { LaporandaftarbankService } from './laporandaftarbank.service';

describe('LaporandaftarbankService', () => {
  let service: LaporandaftarbankService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LaporandaftarbankService],
    }).compile();

    service = module.get<LaporandaftarbankService>(LaporandaftarbankService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
