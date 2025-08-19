import { Test, TestingModule } from '@nestjs/testing';
import { LaporanjenisorderanController } from './laporanjenisorderan.controller';
import { LaporanjenisorderanService } from './laporanjenisorderan.service';

describe('LaporanjenisorderanController', () => {
  let controller: LaporanjenisorderanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaporanjenisorderanController],
      providers: [LaporanjenisorderanService],
    }).compile();

    controller = module.get<LaporanjenisorderanController>(
      LaporanjenisorderanController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
