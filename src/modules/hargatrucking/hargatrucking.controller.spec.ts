import { Test, TestingModule } from '@nestjs/testing';
import { HargatruckingController } from './hargatrucking.controller';
import { HargatruckingService } from './hargatrucking.service';

describe('HargatruckingController', () => {
  let controller: HargatruckingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HargatruckingController],
      providers: [HargatruckingService],
    }).compile();

    controller = module.get<HargatruckingController>(HargatruckingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
