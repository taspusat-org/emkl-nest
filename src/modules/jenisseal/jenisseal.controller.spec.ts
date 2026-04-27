import { Test, TestingModule } from '@nestjs/testing';
import { JenissealController } from './jenisseal.controller';
import { JenissealService } from './jenisseal.service';

describe('JenissealController', () => {
  let controller: JenissealController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JenissealController],
      providers: [JenissealService],
    }).compile();

    controller = module.get<JenissealController>(JenissealController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
