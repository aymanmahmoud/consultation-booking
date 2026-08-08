import { Type } from 'class-transformer';
import { IsDate } from 'class-validator';

export class CreateTimeOffDto {
  @Type(() => Date)
  @IsDate()
  starts_at: Date;

  @Type(() => Date)
  @IsDate()
  ends_at: Date;
}
