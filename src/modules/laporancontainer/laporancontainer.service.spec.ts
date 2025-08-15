import { Test, TestingModule } from '@nestjs/testing';
import { LaporancontainerService } from './laporancontainer.service';

describe('LaporancontainerService', () => {
  let service: LaporancontainerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LaporancontainerService],
    }).compile();

    service = module.get<LaporancontainerService>(LaporancontainerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
