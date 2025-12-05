import { Test, TestingModule } from '@nestjs/testing';
import { PanjarheaderService } from './panjarheader.service';

describe('PanjarheaderService', () => {
  let service: PanjarheaderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PanjarheaderService],
    }).compile();

    service = module.get<PanjarheaderService>(PanjarheaderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
