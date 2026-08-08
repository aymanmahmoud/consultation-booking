import { Matches } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// from/to are Cairo calendar dates (BR-12: single timezone), not
// timestamps - "2026-09-01", not an ISO instant. That ambiguity is exactly
// why a stricter format than @IsDateString() is worth enforcing here.
export class GetAvailabilityQueryDto {
  @Matches(DATE_ONLY, { message: 'from must be a date in YYYY-MM-DD form' })
  from: string;

  @Matches(DATE_ONLY, { message: 'to must be a date in YYYY-MM-DD form' })
  to: string;
}
