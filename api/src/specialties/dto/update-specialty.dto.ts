import { IsString, MinLength } from 'class-validator';

export class UpdateSpecialtyDto {
  @IsString()
  @MinLength(1)
  name: string;
}
