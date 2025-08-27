import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  UsePipes,
  Query,
  NotFoundException,
  InternalServerErrorException,
  Res,
} from '@nestjs/common';
import { ShipperService } from './shipper.service';
import { CreateShipperDto } from './dto/create-shipper.dto';
import { UpdateShipperDto } from './dto/update-shipper.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  FindAllDto,
  FindAllParams,
  FindAllSchema,
} from 'src/common/interfaces/all.interface';
import { dbMssql } from 'src/common/utils/db';

@Controller('shipper')
export class ShipperController {
  constructor(private readonly shipperService: ShipperService) {}

  @Post()
  create(@Body() createShipperDto: CreateShipperDto) {
    return this.shipperService.create(createShipperDto);
  }

  @Get()
  //@SHIPPER
  @UsePipes(new ZodValidationPipe(FindAllSchema))
  async findAll(@Query() query: FindAllDto) {
    const { search, page, limit, sortBy, sortDirection, isLookUp, ...filters } =
      query;

    const sortParams = {
      sortBy: sortBy || 'nama',
      sortDirection: sortDirection || 'asc',
    };

    const pagination = {
      page: page || 1,
      limit: limit === 0 || !limit ? undefined : limit,
    };

    const params: FindAllParams = {
      search,
      filters,
      pagination,
      sort: sortParams as { sortBy: string; sortDirection: 'asc' | 'desc' },
      isLookUp: isLookUp === 'true',
    };
    const trx = await dbMssql.transaction();

    try {
      const result = await this.shipperService.findAll(params, trx);
      trx.commit();

      return result;
    } catch (error) {
      trx.rollback();
      console.error('Error in findAll:', error);
      throw error; // Re-throw the error to be handled by the global exception filter
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shipperService.findOne(+id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateShipperDto: UpdateShipperDto) {
  //   return this.shipperService.update(+id, updateShipperDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shipperService.remove(+id);
  }
}

// import {
//   Controller,
//   Get,
//   Post,
//   Body,
//   Put,
//   Param,
//   Delete,
//   UseGuards,
//   Req,
//   HttpException,
//   HttpStatus,
//   UsePipes,
//   Query,
//   NotFoundException,
//   InternalServerErrorException,
//   Res,
// } from '@nestjs/common';
// import { ShipperService } from './shipper.service';
// import { CreateShipperDto, CreateShipperSchema } from './dto/create-shipper.dto';
// import { UpdateShipperDto, UpdateShipperSchema } from './dto/update-shipper.dto';
// import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
// import {
//   FindAllDto,
//   FindAllParams,
//   FindAllSchema,
// } from 'src/common/interfaces/all.interface';
// import { dbMssql } from 'src/common/utils/db';
// import { isRecordExist } from 'src/utils/utils.service';

// @Controller('shipper')
// export class ShipperController {
//   constructor(private readonly shipperService: ShipperService) {}

//   @Post()
//   @UsePipes(new ZodValidationPipe(CreateShipperSchema))
//   async create(@Body() createShipperDto: CreateShipperDto, @Req() req) {
//     const trx = await dbMssql.transaction();
//     try {
//       const shipperExist = await isRecordExist(
//         'nama',
//         createShipperDto.nama,
//         'shipper',
//       );

//       if (shipperExist) {
//         throw new HttpException(
//           {
//             statusCode: HttpStatus.BAD_REQUEST,
//             message: `Shipper dengan nama ${createShipperDto.nama} sudah ada`,
//           },
//           HttpStatus.BAD_REQUEST,
//         );
//       }
//       createShipperDto.modifiedby = req.user?.user?.username || 'unknown';
//       const result = await this.shipperService.create(createShipperDto, trx);
//       await trx.commit();
//       return result;
//     } catch (error) {
//       await trx.rollback();
//       console.error('Error while creating shipper in controller', error);
//       if (error instanceof HttpException) {
//         throw error;
//       }
//       throw new HttpException(
//         {
//           statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
//           message: 'Failed to create shipper',
//         },
//         HttpStatus.INTERNAL_SERVER_ERROR,
//       );
//     }
//   }

//   @Get()
//   @UsePipes(new ZodValidationPipe(FindAllSchema))
//   async findAll(@Query() query: FindAllDto) {
//     const { search, page, limit, sortBy, sortDirection, isLookUp, ...filters } =
//       query;

//     const sortParams = {
//       sortBy: sortBy || 'nama',
//       sortDirection: sortDirection || 'asc',
//     };

//     const pagination = {
//       page: page || 1,
//       limit: limit === 0 || !limit ? undefined : limit,
//     };

//     const params: FindAllParams = {
//       search,
//       filters,
//       pagination,
//       sort: sortParams as { sortBy: string; sortDirection: 'asc' | 'desc' },
//       isLookUp: isLookUp === 'true',
//     };
//     const trx = await dbMssql.transaction();

//     try {
//       const result = await this.shipperService.findAll(params, trx);
//       trx.commit();

//       return result;
//     } catch (error) {
//       trx.rollback();
//       console.error('Error in findAll:', error);
//       throw error; // Re-throw the error to be handled by the global exception filter
//     }
//   }

//   @Get(':id')
//   async findOne(@Param('id') id: string) {
//     const trx = await dbMssql.transaction();
//     try {
//       const result = await this.shipperService.findOne(+id, trx);
//       if (!result) {
//         throw new NotFoundException('Data not found');
//       }
//       await trx.commit();
//       return result;
//     } catch (error) {
//       console.error('Error fetching data by id:', error);
//       await trx.rollback();
//       throw new InternalServerErrorException('Failed to fetch data by id');
//     }
//   }

//   @Put(':id')
//   @UsePipes(new ZodValidationPipe(UpdateShipperSchema))
//   async update(
//     @Param('id') id: string,
//     @Body() updateShipperDto: UpdateShipperDto,
//     @Req() req,
//   ) {
//     const trx = await dbMssql.transaction();
//     try {
//       const shipperExist = await isRecordExist(
//         'nama',
//         updateShipperDto.nama,
//         'shipper',
//         Number(id),
//       );

//       if (shipperExist) {
//         throw new HttpException(
//           {
//             statusCode: HttpStatus.BAD_REQUEST,
//             message: `Shipper dengan nama ${updateShipperDto.nama} sudah ada`,
//           },
//           HttpStatus.BAD_REQUEST,
//         );
//       }
//       updateShipperDto.modifiedby = req.user?.user?.username || 'unknown';
//       const result = await this.shipperService.update(+id, updateShipperDto, trx);
//       await trx.commit();
//       return result;
//     } catch (error) {
//       await trx.rollback();
//       console.error('Error updating shipper in controller:', error);
//       if (error instanceof HttpException) {
//         throw error;
//       }
//       throw new HttpException(
//         {
//           statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
//           message: 'Failed to update shipper',
//         },
//         HttpStatus.INTERNAL_SERVER_ERROR,
//       );
//     }
//   }

//   @Delete(':id')
//   async remove(@Param('id') id: string, @Req() req) {
//     const trx = await dbMssql.transaction();
//     try {
//       const result = await this.shipperService.remove(
//         +id,
//         trx,
//         req.user?.user?.username,
//       );

//       if (result.status === 404) {
//         throw new NotFoundException(result.message);
//       }

//       await trx.commit();
//       return result;
//     } catch (error) {
//       await trx.rollback();
//       console.error('Error deleting shipper in controller:', error);

//       if (error instanceof NotFoundException) {
//         throw error;
//       }

//       throw new InternalServerErrorException('Failed to delete shipper');
//     }
//   }
// }
