import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
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
  async create(data: any, trx: any) {
    try {
      let result;
      const getDataRequest = await trx('parameter')
        .select('id', 'grp', 'subgrp', 'text')
        .where('grp', 'STATUS JOB')
        .first();

      const check = await trx
        .from(trx.raw(`${this.tableName} WITH (READUNCOMMITTED)`))
        .select('*')
        .where('statusjob', getDataRequest.id)
        .where('job', data.job)
        // .where('tglstatus', data.tglstatus)
        .first();

      const payload = {
        statusjob: getDataRequest.id,
        job: data.job,
        tglstatus: check?.tglstatus ? null : data.tglstatus,
        keterangan: data.keterangan,
        modifiedby: data.modifiedby,
        updated_at: this.utilsService.getTime(),
        created_at: this.utilsService.getTime(),
      };
      // console.log(payload, 'hasil cek', check, check?.id);

      if (check) {
        // console.log('masuk payload', payload);
        result = await trx(this.tableName)
          .where('id', check.id)
          .update(payload)
          .returning('*');
      } else {
        result = await trx(this.tableName).insert(payload).returning('*');
      }

      // console.log('result', result);

      await this.logTrailService.create(
        {
          namatabel: this.tableName,
          postingdari: `ADD STATUS JOB`,
          idtrans: result[0].id,
          nobuktitrans: result[0].id,
          aksi: 'ADD',
          datajson: JSON.stringify(result[0]),
          modifiedby: result[0]?.modifiedby,
        },
        trx,
      );
      return {
        status: HttpStatus.OK,
        message: 'Proses status job berhasil dijalankan.',
      };
    } catch (error) {
      console.error('Error processing status job :', error.message);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process status job ');
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
