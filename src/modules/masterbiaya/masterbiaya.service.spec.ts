import { Test, TestingModule } from '@nestjs/testing';
import { MasterbiayaService } from './masterbiaya.service';

describe('MasterbiayaService', () => {
  let service: MasterbiayaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MasterbiayaService],
    }).compile();

    service = module.get<MasterbiayaService>(MasterbiayaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
