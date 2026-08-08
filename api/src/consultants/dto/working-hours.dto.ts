import { Type } from 'class-transformer';
import { IsArray, IsInt, Matches, Max, Min, ValidateNested } from 'class-validator';

// BR-2: slots only start on the hour, so working-hour boundaries have to
// land on the hour too - a 09:30 start would make BR-2 impossible to honor
// once the availability engine generates slots from these boundaries.
const ON_THE_HOUR = /^([01]\d|2[0-3]):00$/;

export class WorkingHourItemDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week: number; // 0 = Sunday ... 6 = Saturday, matching JS Date#getDay()

  @Matches(ON_THE_HOUR, { message: 'start_time must be an on-the-hour time like "09:00"' })
  start_time: string;

  @Matches(ON_THE_HOUR, { message: 'end_time must be an on-the-hour time like "17:00"' })
  end_time: string;
}

// PUT semantics, same as specialties: this is the full desired weekly
// schedule, replacing whatever's currently set rather than adding to it.
export class ReplaceWorkingHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourItemDto)
  workingHours: WorkingHourItemDto[];
}
