import { Test, TestingModule } from '@nestjs/testing';
import { GroupbiayaextraController } from './groupbiayaextra.controller';
import { GroupbiayaextraService } from './groupbiayaextra.service';

describe('GroupbiayaextraController', () => {
  let controller: GroupbiayaextraController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupbiayaextraController],
      providers: [GroupbiayaextraService],
    }).compile();

    controller = module.get<GroupbiayaextraController>(
      GroupbiayaextraController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
