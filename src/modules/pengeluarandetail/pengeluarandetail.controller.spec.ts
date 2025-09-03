import { Test, TestingModule } from '@nestjs/testing';
import { PengeluarandetailController } from './pengeluarandetail.controller';
import { PengeluarandetailService } from './pengeluarandetail.service';

describe('PengeluarandetailController', () => {
  let controller: PengeluarandetailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PengeluarandetailController],
      providers: [PengeluarandetailService],
    }).compile();

    controller = module.get<PengeluarandetailController>(
      PengeluarandetailController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
