import { Test, TestingModule } from '@nestjs/testing';
import { ComodityController } from './comodity.controller';
import { ComodityService } from './comodity.service';

describe('ComodityController', () => {
  let controller: ComodityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComodityController],
      providers: [ComodityService],
    }).compile();

    controller = module.get<ComodityController>(ComodityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
