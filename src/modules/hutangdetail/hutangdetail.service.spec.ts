import { Test, TestingModule } from '@nestjs/testing';
import { HutangdetailService } from './hutangdetail.service';

describe('HutangdetailService', () => {
  let service: HutangdetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HutangdetailService],
    }).compile();

    service = module.get<HutangdetailService>(HutangdetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
