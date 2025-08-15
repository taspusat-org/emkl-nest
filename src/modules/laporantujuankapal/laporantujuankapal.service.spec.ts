import { Test, TestingModule } from '@nestjs/testing';
import { LaporantujuankapalService } from './laporantujuankapal.service';

describe('LaporantujuankapalService', () => {
  let service: LaporantujuankapalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LaporantujuankapalService],
    }).compile();

    service = module.get<LaporantujuankapalService>(LaporantujuankapalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
