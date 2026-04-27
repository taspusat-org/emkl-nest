import { Test, TestingModule } from '@nestjs/testing';
import { BiayaemklController } from './biayaemkl.controller';
import { BiayaemklService } from './biayaemkl.service';

describe('BiayaemklController', () => {
  let controller: BiayaemklController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BiayaemklController],
      providers: [BiayaemklService],
    }).compile();

    controller = module.get<BiayaemklController>(BiayaemklController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
