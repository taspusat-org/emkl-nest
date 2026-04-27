import { Test, TestingModule } from '@nestjs/testing';
import { HutangheaderController } from './hutangheader.controller';
import { HutangheaderService } from './hutangheader.service';

describe('HutangheaderController', () => {
  let controller: HutangheaderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HutangheaderController],
      providers: [HutangheaderService],
    }).compile();

    controller = module.get<HutangheaderController>(HutangheaderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
