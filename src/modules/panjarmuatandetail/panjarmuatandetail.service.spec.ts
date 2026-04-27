import { Test, TestingModule } from '@nestjs/testing';
import { PanjarmuatandetailService } from './panjarmuatandetail.service';

describe('PanjarmuatandetailService', () => {
  let service: PanjarmuatandetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PanjarmuatandetailService],
    }).compile();

    service = module.get<PanjarmuatandetailService>(PanjarmuatandetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
