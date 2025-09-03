import { Test, TestingModule } from '@nestjs/testing';
import { PengeluarandetailService } from './pengeluarandetail.service';

describe('PengeluarandetailService', () => {
  let service: PengeluarandetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PengeluarandetailService],
    }).compile();

    service = module.get<PengeluarandetailService>(PengeluarandetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
