import { Test, TestingModule } from '@nestjs/testing';
import { LaporanalatbayarService } from './laporanalatbayar.service';

describe('LaporanalatbayarService', () => {
  let service: LaporanalatbayarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LaporanalatbayarService],
    }).compile();

    service = module.get<LaporanalatbayarService>(LaporanalatbayarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
