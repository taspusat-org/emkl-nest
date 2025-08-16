import { Test, TestingModule } from '@nestjs/testing';
import { EmklController } from './emkl.controller';
import { EmklService } from './emkl.service';

describe('EmklController', () => {
  let controller: EmklController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmklController],
      providers: [EmklService],
    }).compile();

    controller = module.get<EmklController>(EmklController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
