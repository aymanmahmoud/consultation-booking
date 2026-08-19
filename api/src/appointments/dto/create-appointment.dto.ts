import { Type } from 'class-transformer';
import { IsDate, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID('4')
  consultant_id: string;

  @Type(() => Date)
  @IsDate()
  starts_at: Date;
}
