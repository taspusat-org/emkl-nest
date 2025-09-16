import { Test, TestingModule } from '@nestjs/testing';
import { MasterbiayaController } from './masterbiaya.controller';
import { MasterbiayaService } from './masterbiaya.service';

describe('MasterbiayaController', () => {
  let controller: MasterbiayaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MasterbiayaController],
      providers: [MasterbiayaService],
    }).compile();

    controller = module.get<MasterbiayaController>(MasterbiayaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
