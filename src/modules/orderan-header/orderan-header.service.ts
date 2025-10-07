import { HttpStatus, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateOrderanHeaderDto } from './dto/create-orderan-header.dto';
import { UpdateOrderanHeaderDto } from './dto/update-orderan-header.dto';
import { RedisService } from 'src/common/redis/redis.service';
import { formatDateToSQL, UtilsService } from 'src/utils/utils.service';
import { LocksService } from '../locks/locks.service';
import { GlobalService } from '../global/global.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { RunningNumberService } from '../running-number/running-number.service';
import { StatusjobService } from '../statusjob/statusjob.service';
import { OrderanMuatanService } from './orderan-muatan.service';

@Injectable()
export class OrderanHeaderService {
  private readonly tableName: string = 'orderanheader';

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisService: RedisService,
    private readonly utilsService: UtilsService,
    private readonly locksService: LocksService,
    private readonly globalService: GlobalService,
    private readonly logTrailService: LogtrailService,
    private readonly statusJobService: StatusjobService,
    private readonly runningNumberService: RunningNumberService,
    private readonly orderanMuatanService: OrderanMuatanService,
  ) {}
  create(createOrderanHeaderDto: CreateOrderanHeaderDto) {
    return 'This action adds a new orderanHeader';
  }

  findAll() {
    return `This action returns all orderanHeader`;
  }

  findOne(id: number) {
    return `This action returns a #${id} orderanHeader`;
  }

  update(id: number, updateOrderanHeaderDto: UpdateOrderanHeaderDto) {
    return `This action updates a #${id} orderanHeader`;
  }

  remove(id: number) {
    return `This action removes a #${id} orderanHeader`;
  }

  async approval(data: any, trx: any) {
    try {
      data.tanggal = formatDateToSQL(data.tanggal)
      data.created_at = this.utilsService.getTime();
      data.updated_at = this.utilsService.getTime();
      let formatNoBuktiOrderan
      let serviceCreate
      const {
        mode,
        bookingheader_id,
        booking_id,
        jenisorder_id,
        tanggal,
        marketing_id,
        tujuankapal_id,
        ...approvalData
      } = data;

      const getJenisOrderanMuatan = await trx
        .from(trx.raw(`jenisorderan WITH (READUNCOMMITTED)`))
        .select('id')
        .where('nama', 'MUATAN')
        .first();    
      const getJenisOrderanBongkaran = await trx
        .from(trx.raw(`jenisorderan WITH (READUNCOMMITTED)`))
        .select('id')
        .where('nama', 'BONGKARAN')
        .first();
      const getJenisOrderanImport = await trx
        .from(trx.raw(`jenisorderan WITH (READUNCOMMITTED)`))
        .select('id')
        .where('nama', 'IMPORT')
        .first();
      const getJenisOrderanExport = await trx
        .from(trx.raw(`jenisorderan WITH (READUNCOMMITTED)`))
        .select('id')
        .where('nama', 'EKSPORT')
        .first();

      switch (jenisorder_id) {
        case getJenisOrderanMuatan?.id:
          serviceCreate = this.orderanMuatanService;
          formatNoBuktiOrderan = await trx
            .from(trx.raw(`parameter WITH (READUNCOMMITTED)`))
            .select(['id', 'grp', 'subgrp', 'text'])
            .where('grp', 'NOMOR ORDERAN MUATAN')
            .first();
          break;
        // case 'IMPORT':
        //   service = this.hitungmodalimportService;
        //   break;
        // case 'EXPORT':
        //   service = this.hitungmodalexportService;
        //   break;
        default:
          serviceCreate = this.orderanMuatanService;
          formatNoBuktiOrderan = await trx
            .from(trx.raw(`parameter WITH (READUNCOMMITTED)`))
            .select(['id', 'grp', 'subgrp', 'text'])
            .where('grp', 'NOMOR ORDERAN MUATAN')
            .first();
          break;
      }    

      const nomorBukti =
        await this.runningNumberService.generateRunningNumber(
          trx,
          formatNoBuktiOrderan.grp,
          formatNoBuktiOrderan.subgrp, 
          this.tableName,
          data.tanggal,
          null,
          tujuankapal_id,
          null,
          marketing_id,
        );
        
      const headerData = {
        nobukti: nomorBukti,
        tglbukti: tanggal,
        jenisorder_id: jenisorder_id,
        statusformat: formatNoBuktiOrderan.id,
        modifiedby: data.modifiedby,
        updated_at: data.created_at,
        created_at: data.updated_at,
      };

      Object.keys(headerData).forEach((key) => {
        if (typeof headerData[key] === 'string') {
          const value = headerData[key];
          const dateRegex = /^\d{2}-\d{2}-\d{4}$/;

          if (dateRegex.test(value)) {
            headerData[key] = formatDateToSQL(value);
          } else {
            headerData[key] = headerData[key].toUpperCase();
          }
        }
      });

      const insertedData = await trx(this.tableName)
        .insert(headerData)
        .returning('*');
      const newItem = insertedData[0];
      
      if (newItem) {
        await trx('bookingorderanheader').where('id', bookingheader_id).update('orderan_nobukti', newItem.nobukti)
      }

      await this.logTrailService.create(
        {
          namatable: this.tableName,
          postingdari: 'ADD ORDERAN HEADER',
          idtrans: newItem.id,
          nobuktitrans: newItem.id,
          aksi: 'ADD',
          datajson: JSON.stringify(newItem),
          modifiedby: newItem.modifiedby,
        },
        trx,
      );

      // INSERT TO STATUS PENDUKUNG DAN STATUS JOB
      const statusJobData = {
        job: approvalData?.transaksi_id[0],
        tglstatus: headerData.tglbukti,
        modifiedby: headerData.modifiedby,
        created_at: approvalData.created_at,
        updated_at: approvalData.updated_at,
      }
      const storeStatusJob = await this.statusJobService.create(statusJobData, trx)
      const approvalStatusPendukung = await this.globalService.approval(approvalData, trx)

      // INSERT TO ORDERAN
      const orderanData = {
        booking_id: booking_id,
        orderan_id: newItem.id,
        nobukti: newItem.nobukti,
        modifiedby: newItem.modifiedby,
        updated_at: data.created_at,
        created_at: data.updated_at,
      }
      const insertOrderan = await serviceCreate.create(orderanData, trx) 
      
      if (newItem && insertOrderan && storeStatusJob.status === approvalStatusPendukung.status) {
        return {
          status: HttpStatus.OK,
          message: 'Proses Approval Booking Orderan Berhasil'
        }
      } else {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Proses Approval Booking Orderan Gagal'
        }
      }
      
    } catch (error) {
      console.error('Error processing approval in orderan header controller:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process approval in orderan header controller');
    }
  }

  async nonApproval(data: any, trx: any) {
    try {
      let serviceDelete
      const {
        mode,
        jenisorder_id,
        orderan_nobukti,
        ...nonApprovalData
      } = data

      const getJenisOrderanMuatan = await trx
        .from(trx.raw(`jenisorderan WITH (READUNCOMMITTED)`))
        .select('id')
        .where('nama', 'MUATAN')
        .first();    
      const getJenisOrderanBongkaran = await trx
        .from(trx.raw(`jenisorderan WITH (READUNCOMMITTED)`))
        .select('id')
        .where('nama', 'BONGKARAN')
        .first();
      const getJenisOrderanImport = await trx
        .from(trx.raw(`jenisorderan WITH (READUNCOMMITTED)`))
        .select('id')
        .where('nama', 'IMPORT')
        .first();
      const getJenisOrderanExport = await trx
        .from(trx.raw(`jenisorderan WITH (READUNCOMMITTED)`))
        .select('id')
        .where('nama', 'EKSPORT')
        .first();    

      switch (jenisorder_id) {
        case getJenisOrderanMuatan?.id:
          serviceDelete = this.orderanMuatanService;
          break;
        // case 'IMPORT':
        //   service = this.hitungmodalimportService;
        //   break;
        // case 'EXPORT':
        //   service = this.hitungmodalexportService;
        //   break; 
        default:
          serviceDelete = this.orderanMuatanService;
          break;
      }

      const statusJobData = {
        job: nonApprovalData?.transaksi_id[0],
        tglstatus: null,
        modifiedby: nonApprovalData.modifiedby,
        created_at: nonApprovalData.created_at,
        updated_at: nonApprovalData.updated_at,
      }

      const storeStatusJob = await this.statusJobService.create(statusJobData, trx)
      const approvalStatusPendukung = await this.globalService.nonApproval(nonApprovalData, trx)
      const deletedOrderan = await serviceDelete.delete(orderan_nobukti, trx)
      const deletedOrderanHeader = await this.utilsService.lockAndDestroy(
        orderan_nobukti,
        this.tableName,
        'nobukti',
        trx,
      );
      
      if (deletedOrderan && deletedOrderanHeader) {
        await trx('bookingorderanheader').where('orderan_nobukti', orderan_nobukti).update('orderan_nobukti', null)
      }

      if (deletedOrderanHeader && deletedOrderan && storeStatusJob.status === approvalStatusPendukung.status) {
        return {
          status: HttpStatus.OK,
          message: 'Proses Non Approval Booking Orderan Berhasil'
        }
      } else {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Proses NonApproval Booking Orderan Gagal'
        }
      }
      
    } catch (error) {
      console.error('Error processing non approval in orderan header controller:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process approval in orderan header controller');
    }
  }
}
