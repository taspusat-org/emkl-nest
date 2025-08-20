import { Test, TestingModule } from '@nestjs/testing';
import { ManagermarketingheaderController } from './managermarketingheader.controller';
import { ManagermarketingheaderService } from './managermarketingheader.service';

describe('ManagermarketingheaderController', () => {
  let controller: ManagermarketingheaderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManagermarketingheaderController],
      providers: [ManagermarketingheaderService],
    }).compile();

    controller = module.get<ManagermarketingheaderController>(
      ManagermarketingheaderController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
