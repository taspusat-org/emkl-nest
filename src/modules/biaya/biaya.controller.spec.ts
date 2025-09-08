import { Test, TestingModule } from '@nestjs/testing';
import { BiayaController } from './biaya.controller';
import { BiayaService } from './biaya.service';

describe('BiayaController', () => {
  let controller: BiayaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BiayaController],
      providers: [BiayaService],
    }).compile();

    controller = module.get<BiayaController>(BiayaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
