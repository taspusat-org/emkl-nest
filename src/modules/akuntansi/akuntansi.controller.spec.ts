import { Test, TestingModule } from '@nestjs/testing';
import { AkuntansiController } from './akuntansi.controller';
import { AkuntansiService } from './akuntansi.service';

describe('AkuntansiController', () => {
  let controller: AkuntansiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AkuntansiController],
      providers: [AkuntansiService],
    }).compile();

    controller = module.get<AkuntansiController>(AkuntansiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
