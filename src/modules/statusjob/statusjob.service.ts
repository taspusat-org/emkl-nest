import { Injectable } from '@nestjs/common';
import { CreateStatusjobDto } from './dto/create-statusjob.dto';
import { UpdateStatusjobDto } from './dto/update-statusjob.dto';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';

@Injectable()
export class StatusjobService {
  private readonly tableName = 'statusjob';

  constructor(
    private readonly utilsService: UtilsService,
    private readonly logTrailService: LogtrailService,
  ) {}
  async create(data: any, modifiedby: any, trx: any) {
    try {
      const getDataRequest = await trx('parameter')
        .select('id', 'grp', 'subgrp', 'text', 'kelompok')
        .where('grp', 'STATUS JOB')
        .andWhere('subgrp', 'ORDERANMUATAN');
      console.log(getDataRequest);
      if (getDataRequest && getDataRequest.length > 0) {
        const payload = getDataRequest.map((detail: any) => ({
          statusjob: detail.id,
          job: data.job,
          tglstatus: data.tglstatus,
          keterangan: data.keterangan,
          modifiedby: modifiedby,
          updated_at: this.utilsService.getTime(),
          created_at: this.utilsService.getTime(),
        }));
        const insertedData = await trx(this.tableName)
          .insert(payload)
          .returning('*');
        await this.logTrailService.create(
          {
            namatabel: this.tableName,
            postingdari: `ADD STATUS JOB`,
            idtrans: insertedData[0].id,
            nobuktitrans: insertedData[0].id,
            aksi: 'ADD',
            datajson: JSON.stringify(insertedData[0]),
            modifiedby: insertedData[0]?.modifiedby,
          },
          trx,
        );
        return { success: true };
      }
      return { success: true };
    } catch (error) {
      throw new Error(error);
    }
  }
  findAll() {
    return `This action returns all statusjob`;
  }

  findOne(id: number) {
    return `This action returns a #${id} statusjob`;
  }

  update(id: number, updateStatusjobDto: UpdateStatusjobDto) {
    return `This action updates a #${id} statusjob`;
  }

  remove(id: number) {
    return `This action removes a #${id} statusjob`;
  }
}
