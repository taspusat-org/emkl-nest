import { Test, TestingModule } from '@nestjs/testing';
import { LaporanjenismuatanController } from './laporanjenismuatan.controller';
import { LaporanjenismuatanService } from './laporanjenismuatan.service';

describe('LaporanjenismuatanController', () => {
  let controller: LaporanjenismuatanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaporanjenismuatanController],
      providers: [LaporanjenismuatanService],
    }).compile();

    controller = module.get<LaporanjenismuatanController>(
      LaporanjenismuatanController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
