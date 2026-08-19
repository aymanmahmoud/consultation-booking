import { IsIn, IsOptional } from 'class-validator';

// F-18: client sees upcoming/past. Extended to consultants too (F-19 just
// says "list own bookings", but there's no reason the split shouldn't
// apply equally there).
export class ListAppointmentsQueryDto {
  @IsOptional()
  @IsIn(['upcoming', 'past'])
  when?: 'upcoming' | 'past';
}
