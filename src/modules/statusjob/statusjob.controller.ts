import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { StatusjobService } from './statusjob.service';
import { CreateStatusjobDto } from './dto/create-statusjob.dto';
import { UpdateStatusjobDto } from './dto/update-statusjob.dto';

@Controller('statusjob')
export class StatusjobController {
  constructor(private readonly statusjobService: StatusjobService) {}
}
