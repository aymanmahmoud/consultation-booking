import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

// F-08: a consultant may update headline/bio/price on their own profile.
// name was added alongside Day 3's search feature (F-13 needs something to
// search by) and belongs here for the same reason. is_active isn't here -
// the spec never defines who's allowed to flip it (implied admin action per
// the Actors table, but no endpoint for it exists yet), so it's left alone
// rather than guessed at.
export class UpdateConsultantProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}
