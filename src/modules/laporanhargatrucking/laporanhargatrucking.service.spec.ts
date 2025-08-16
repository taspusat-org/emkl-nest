import { Test, TestingModule } from '@nestjs/testing';
import { LaporanhargatruckingService } from './laporanhargatrucking.service';

describe('LaporanhargatruckingService', () => {
  let service: LaporanhargatruckingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LaporanhargatruckingService],
    }).compile();

    service = module.get<LaporanhargatruckingService>(
      LaporanhargatruckingService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
