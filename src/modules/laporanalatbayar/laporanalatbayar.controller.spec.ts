import { Test, TestingModule } from '@nestjs/testing';
import { LaporanalatbayarController } from './laporanalatbayar.controller';
import { LaporanalatbayarService } from './laporanalatbayar.service';

describe('LaporanalatbayarController', () => {
  let controller: LaporanalatbayarController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaporanalatbayarController],
      providers: [LaporanalatbayarService],
    }).compile();

    controller = module.get<LaporanalatbayarController>(
      LaporanalatbayarController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
