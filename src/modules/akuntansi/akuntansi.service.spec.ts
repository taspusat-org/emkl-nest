import { Test, TestingModule } from '@nestjs/testing';
import { AkuntansiService } from './akuntansi.service';

describe('AkuntansiService', () => {
  let service: AkuntansiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AkuntansiService],
    }).compile();

    service = module.get<AkuntansiService>(AkuntansiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
