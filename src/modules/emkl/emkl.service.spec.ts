import { Test, TestingModule } from '@nestjs/testing';
import { EmklService } from './emkl.service';

describe('EmklService', () => {
  let service: EmklService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmklService],
    }).compile();

    service = module.get<EmklService>(EmklService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
