import { Test, TestingModule } from '@nestjs/testing';
import { AsalkapalService } from './asalkapal.service';

describe('AsalkapalService', () => {
  let service: AsalkapalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AsalkapalService],
    }).compile();

    service = module.get<AsalkapalService>(AsalkapalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
