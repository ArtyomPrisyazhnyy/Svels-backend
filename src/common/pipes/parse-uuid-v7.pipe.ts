import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { isUuidV7 } from '../utils/uuid.util';

@Injectable()
export class ParseUuidV7Pipe implements PipeTransform<string, string> {
  transform(value: string, _metadata: ArgumentMetadata): string {
    if (!isUuidV7(value)) {
      throw new BadRequestException('Некорректный UUIDv7');
    }
    return value;
  }
}
