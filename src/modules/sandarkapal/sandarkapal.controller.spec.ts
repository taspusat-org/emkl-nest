import { Test, TestingModule } from '@nestjs/testing';
import { SandarkapalController } from './sandarkapal.controller';
import { SandarkapalService } from './sandarkapal.service';

describe('SandarkapalController', () => {
  let controller: SandarkapalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SandarkapalController],
      providers: [SandarkapalService],
    }).compile();

    controller = module.get<SandarkapalController>(SandarkapalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
