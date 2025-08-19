import { Test, TestingModule } from '@nestjs/testing';
import { LaporandaftarbankController } from './laporandaftarbank.controller';
import { LaporandaftarbankService } from './laporandaftarbank.service';

describe('LaporandaftarbankController', () => {
  let controller: LaporandaftarbankController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaporandaftarbankController],
      providers: [LaporandaftarbankService],
    }).compile();

    controller = module.get<LaporandaftarbankController>(
      LaporandaftarbankController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
