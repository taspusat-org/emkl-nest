import { Test, TestingModule } from '@nestjs/testing';
import { DivisiController } from './divisi.controller';
import { DivisiService } from './divisi.service';

describe('DivisiController', () => {
  let controller: DivisiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DivisiController],
      providers: [DivisiService],
    }).compile();

    controller = module.get<DivisiController>(DivisiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
