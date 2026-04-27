import { Test, TestingModule } from '@nestjs/testing';
import { HutangdetailController } from './hutangdetail.controller';
import { HutangdetailService } from './hutangdetail.service';

describe('HutangdetailController', () => {
  let controller: HutangdetailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HutangdetailController],
      providers: [HutangdetailService],
    }).compile();

    controller = module.get<HutangdetailController>(HutangdetailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
