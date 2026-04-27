import { Test, TestingModule } from '@nestjs/testing';
import { AsalkapalController } from './asalkapal.controller';
import { AsalkapalService } from './asalkapal.service';

describe('AsalkapalController', () => {
  let controller: AsalkapalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AsalkapalController],
      providers: [AsalkapalService],
    }).compile();

    controller = module.get<AsalkapalController>(AsalkapalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
