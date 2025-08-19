import {
  Injectable,
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType<any>) {}

  async transform(value: any, metadata: ArgumentMetadata) {
    try {
      // Validate using Zod schema
      await this.schema.parseAsync(value);
      return value;
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors
          .map((err) => `${err.path[0]}: ${err.message}`)
          .join(', ');
        throw new BadRequestException(`Validation failed: ${errors}`);
      }
      throw error;
    }
  }
}
