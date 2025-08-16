import { Test, TestingModule } from '@nestjs/testing';
import { LaporanhargatruckingController } from './laporanhargatrucking.controller';
import { LaporanhargatruckingService } from './laporanhargatrucking.service';

describe('LaporanhargatruckingController', () => {
  let controller: LaporanhargatruckingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LaporanhargatruckingController],
      providers: [LaporanhargatruckingService],
    }).compile();

    controller = module.get<LaporanhargatruckingController>(
      LaporanhargatruckingController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
