import { Test, TestingModule } from '@nestjs/testing';
import { KapalController } from './kapal.controller';
import { KapalService } from './kapal.service';

describe('KapalController', () => {
  let controller: KapalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KapalController],
      providers: [KapalService],
    }).compile();

    controller = module.get<KapalController>(KapalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
