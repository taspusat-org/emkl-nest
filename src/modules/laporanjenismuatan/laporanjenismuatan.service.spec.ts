import { Test, TestingModule } from '@nestjs/testing';
import { LaporanjenismuatanService } from './laporanjenismuatan.service';

describe('LaporanjenismuatanService', () => {
  let service: LaporanjenismuatanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LaporanjenismuatanService],
    }).compile();

    service = module.get<LaporanjenismuatanService>(LaporanjenismuatanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
