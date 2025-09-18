import { Test, TestingModule } from '@nestjs/testing';
import { JenissealService } from './jenisseal.service';

describe('JenissealService', () => {
  let service: JenissealService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JenissealService],
    }).compile();

    service = module.get<JenissealService>(JenissealService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
