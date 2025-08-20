import { PartialType } from '@nestjs/mapped-types';
import { CreateManagermarketingheaderDto } from './create-managermarketingheader.dto';

export class UpdateManagermarketingheaderDto extends PartialType(
  CreateManagermarketingheaderDto,
) {}
