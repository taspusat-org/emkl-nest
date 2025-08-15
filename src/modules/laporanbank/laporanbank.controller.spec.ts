import { Test, TestingModule } from '@nestjs/testing';
import { LaporanbankController } from './laporanbank.controller';
import { LaporanbankService } from './laporanbank.service';

describe('LaporanbankController', () => {
  let controller: LaporanbankController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaporanbankController],
      providers: [LaporanbankService],
    }).compile();

    controller = module.get<LaporanbankController>(LaporanbankController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
