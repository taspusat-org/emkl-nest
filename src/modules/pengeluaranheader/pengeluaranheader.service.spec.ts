import { Test, TestingModule } from '@nestjs/testing';
import { PengeluaranheaderService } from './pengeluaranheader.service';

describe('PengeluaranheaderService', () => {
  let service: PengeluaranheaderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PengeluaranheaderService],
    }).compile();

    service = module.get<PengeluaranheaderService>(PengeluaranheaderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
