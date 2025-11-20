import { Test, TestingModule } from '@nestjs/testing';
import { GroupbiayaextraService } from './groupbiayaextra.service';

describe('GroupbiayaextraService', () => {
  let service: GroupbiayaextraService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupbiayaextraService],
    }).compile();

    service = module.get<GroupbiayaextraService>(GroupbiayaextraService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
