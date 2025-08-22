import { Test, TestingModule } from '@nestjs/testing';
import { SandarkapalService } from './sandarkapal.service';

describe('SandarkapalService', () => {
  let service: SandarkapalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SandarkapalService],
    }).compile();

    service = module.get<SandarkapalService>(SandarkapalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
