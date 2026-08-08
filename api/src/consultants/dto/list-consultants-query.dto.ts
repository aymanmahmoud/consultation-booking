import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListConsultantsQueryDto {
  // Query strings arrive as strings even for numbers - @Type(() => Number)
  // is what lets the global ValidationPipe's `transform: true` turn
  // "?page=2" into an actual number before @IsInt() even runs.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsUUID('4')
  specialtyId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
