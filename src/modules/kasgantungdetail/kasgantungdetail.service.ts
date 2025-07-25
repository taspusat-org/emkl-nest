import { Injectable, Logger } from '@nestjs/common';
import { CreateKasgantungdetailDto } from './dto/create-kasgantungdetail.dto';
import { UpdateKasgantungdetailDto } from './dto/update-kasgantungdetail.dto';

@Injectable()
export class KasgantungdetailService {
  private readonly tableName = 'kasgantungdetail';
  private readonly logger = new Logger(KasgantungdetailService.name);
  create(createKasgantungdetailDto: CreateKasgantungdetailDto) {
    return 'This action adds a new kasgantungdetail';
  }

  async findAll(id: number, trx: any) {
    const result = await trx(`${this.tableName} as p`)
      .select(
        'p.id',
        'p.kasgantung_id', // Updated field name
        'p.nobukti',
        'p.keterangan',
        'p.nominal', // Updated field name
        'p.info',
        'p.modifiedby',
        'p.editing_by',
        trx.raw("FORMAT(p.editing_at, 'dd-MM-yyyy HH:mm:ss') as editing_at"),
        trx.raw("FORMAT(p.created_at, 'dd-MM-yyyy HH:mm:ss') as created_at"),
        trx.raw("FORMAT(p.updated_at, 'dd-MM-yyyy HH:mm:ss') as updated_at"),
      )
      .where('p.kasgantung_id', id) // Updated field name
      .orderBy('p.created_at', 'desc'); // Optional: Order by creation date

    if (!result.length) {
      this.logger.warn(`No Data found for ID: ${id}`);
      return {
        status: false,
        message: 'No data found',
        data: [],
      };
    }

    return {
      status: true,
      message: 'Kas Gantung Detail data fetched successfully',
      data: result,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} kasgantungdetail`;
  }

  update(id: number, updateKasgantungdetailDto: UpdateKasgantungdetailDto) {
    return `This action updates a #${id} kasgantungdetail`;
  }

  remove(id: number) {
    return `This action removes a #${id} kasgantungdetail`;
  }
}
