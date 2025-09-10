import { Test, TestingModule } from '@nestjs/testing';
import { HutangheaderService } from './hutangheader.service';

describe('HutangheaderService', () => {
  let service: HutangheaderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HutangheaderService],
    }).compile();

    service = module.get<HutangheaderService>(HutangheaderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
