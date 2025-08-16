import { Test, TestingModule } from '@nestjs/testing';
import { HargatruckingService } from './hargatrucking.service';

describe('HargatruckingService', () => {
  let service: HargatruckingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HargatruckingService],
    }).compile();

    service = module.get<HargatruckingService>(HargatruckingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
