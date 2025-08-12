import { Test, TestingModule } from '@nestjs/testing';
import { TujuankapalService } from './tujuankapal.service';

describe('TujuankapalService', () => {
  let service: TujuankapalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TujuankapalService],
    }).compile();

    service = module.get<TujuankapalService>(TujuankapalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
