import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { cairoWallTimeToUtc, computeAvailableSlots } from './availability.util';
import { GetAvailabilityQueryDto } from './dto/get-availability-query.dto';

const MAX_RANGE_DAYS = 31;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(consultantId: string, query: GetAvailabilityQueryDto) {
    if (query.from > query.to) {
      throw new BadRequestException('from must not be after to');
    }

    const rangeStart = cairoWallTimeToUtc(query.from, 0);
    const rangeEndExclusive = cairoWallTimeToUtc(query.to, 24);
    const rangeDays = Math.round((rangeEndExclusive.getTime() - rangeStart.getTime()) / 86_400_000);
    if (rangeDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
    }

    const profile = await this.prisma.consultantProfile.findUnique({ where: { id: consultantId } });
    if (!profile) {
      throw new NotFoundException('Consultant not found');
    }

    // BR-10: an inactive consultant "cannot receive new bookings" - rather
    // than compute a real schedule that's unbookable anyway, just report
    // no availability. Still 200, not 404: the profile does exist, and
    // GET /consultants/:id itself doesn't block viewing an inactive one.
    if (!profile.is_active) {
      return { consultant_id: consultantId, from: query.from, to: query.to, slots: [] };
    }

    const [workingHoursRows, timeOffRows, confirmedAppointments] = await Promise.all([
      this.prisma.workingHours.findMany({ where: { consultant_id: consultantId } }),
      this.prisma.timeOff.findMany({ where: { consultant_id: consultantId } }),
      this.prisma.appointment.findMany({
        where: {
          consultant_id: consultantId,
          status: AppointmentStatus.confirmed,
          starts_at: { gte: rangeStart, lt: rangeEndExclusive },
        },
        select: { starts_at: true },
      }),
    ]);

    const slots = computeAvailableSlots({
      from: query.from,
      to: query.to,
      now: new Date(),
      workingHours: workingHoursRows.map((row) => ({
        day_of_week: row.day_of_week,
        start_hour: row.start_time.getUTCHours(),
        end_hour: row.end_time.getUTCHours(),
      })),
      timeOff: timeOffRows.map((row) => ({ starts_at: row.starts_at, ends_at: row.ends_at })),
      confirmedAppointmentStarts: new Set(confirmedAppointments.map((a) => a.starts_at.getTime())),
    });

    return { consultant_id: consultantId, from: query.from, to: query.to, slots };
  }
}
