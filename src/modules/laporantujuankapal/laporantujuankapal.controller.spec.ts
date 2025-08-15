import { Test, TestingModule } from '@nestjs/testing';
import { LaporantujuankapalController } from './laporantujuankapal.controller';
import { LaporantujuankapalService } from './laporantujuankapal.service';

describe('LaporantujuankapalController', () => {
  let controller: LaporantujuankapalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaporantujuankapalController],
      providers: [LaporantujuankapalService],
    }).compile();

    controller = module.get<LaporantujuankapalController>(
      LaporantujuankapalController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
