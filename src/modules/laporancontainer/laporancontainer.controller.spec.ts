import { Test, TestingModule } from '@nestjs/testing';
import { LaporancontainerController } from './laporancontainer.controller';
import { LaporancontainerService } from './laporancontainer.service';

describe('LaporancontainerController', () => {
  let controller: LaporancontainerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaporancontainerController],
      providers: [LaporancontainerService],
    }).compile();

    controller = module.get<LaporancontainerController>(LaporancontainerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
