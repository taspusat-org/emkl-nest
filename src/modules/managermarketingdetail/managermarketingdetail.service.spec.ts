import { Test, TestingModule } from '@nestjs/testing';
import { ManagermarketingdetailService } from './managermarketingdetail.service';

describe('ManagermarketingdetailService', () => {
  let service: ManagermarketingdetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ManagermarketingdetailService],
    }).compile();

    service = module.get<ManagermarketingdetailService>(
      ManagermarketingdetailService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
