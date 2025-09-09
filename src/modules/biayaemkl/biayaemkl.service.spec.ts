import { Test, TestingModule } from '@nestjs/testing';
import { BiayaemklService } from './biayaemkl.service';

describe('BiayaemklService', () => {
  let service: BiayaemklService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BiayaemklService],
    }).compile();

    service = module.get<BiayaemklService>(BiayaemklService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
