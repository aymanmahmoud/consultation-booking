import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma, Role } from '../../generated/prisma/client';
import { cairoDateStringOf, computeAvailableSlots } from '../availability/availability.util';
import { ConsultantsService } from '../consultants/consultants.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';

const HOUR_MS = 3_600_000;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consultantsService: ConsultantsService,
  ) {}

  async book(clientId: string, dto: CreateAppointmentDto) {
    const startsAt = dto.starts_at;

    // BR-2: slots only start on the hour. Cairo's UTC offset is always a
    // whole number of hours (+2 or +3, DST included), so "on the hour in
    // UTC" and "on the hour in Cairo" are the same check.
    if (startsAt.getTime() % HOUR_MS !== 0) {
      throw new BadRequestException('starts_at must be exactly on the hour');
    }

    // BR-6: no past bookings.
    if (startsAt <= new Date()) {
      throw new BadRequestException('starts_at must be in the future');
    }

    const consultant = await this.prisma.consultantProfile.findUnique({
      where: { id: dto.consultant_id },
    });
    if (!consultant) {
      throw new NotFoundException('Consultant not found');
    }
    if (!consultant.is_active) {
      // BR-10: an inactive consultant cannot receive new bookings.
      throw new BadRequestException('This consultant is not currently accepting bookings');
    }

    const cairoDate = cairoDateStringOf(startsAt);
    const [workingHoursRows, timeOffRows, confirmedAppointments] = await Promise.all([
      this.prisma.workingHours.findMany({ where: { consultant_id: dto.consultant_id } }),
      this.prisma.timeOff.findMany({ where: { consultant_id: dto.consultant_id } }),
      this.prisma.appointment.findMany({
        where: {
          consultant_id: dto.consultant_id,
          status: AppointmentStatus.confirmed,
          starts_at: { gte: new Date(`${cairoDate}T00:00:00.000Z`), lt: new Date(startsAt.getTime() + HOUR_MS) },
        },
        select: { starts_at: true },
      }),
    ]);

    // Reuse the Week 2 availability engine instead of re-deriving "is this
    // slot within working hours and not time-off'd" a second time. Pass an
    // EMPTY confirmed-appointments set here on purpose: this call answers
    // "is this a structurally real slot" (BR-2/working-hours/time-off/
    // past), not "is it free" - that's checked separately next, so the two
    // failure modes get different, more useful error responses.
    const structuralSlots = computeAvailableSlots({
      from: cairoDate,
      to: cairoDate,
      now: new Date(),
      workingHours: workingHoursRows.map((row) => ({
        day_of_week: row.day_of_week,
        start_hour: row.start_time.getUTCHours(),
        end_hour: row.end_time.getUTCHours(),
      })),
      timeOff: timeOffRows.map((row) => ({ starts_at: row.starts_at, ends_at: row.ends_at })),
      confirmedAppointmentStarts: new Set(),
    });
    const isRealSlot = structuralSlots.some((s) => s.starts_at.getTime() === startsAt.getTime());
    if (!isRealSlot) {
      throw new BadRequestException('That slot is not available for booking');
    }

    // Fast, friendly check for the common (non-racing) case: tell the
    // client plainly that the slot's taken instead of a generic 409 from a
    // failed insert. This is NOT what makes double-booking impossible -
    // see the P2002 catch below for that.
    const alreadyBooked = confirmedAppointments.some((a) => a.starts_at.getTime() === startsAt.getTime());
    if (alreadyBooked) {
      throw new ConflictException('That slot has already been booked');
    }

    const id = randomUUID();
    try {
      return await this.prisma.appointment.create({
        data: {
          id,
          client_id: clientId,
          consultant_id: dto.consultant_id,
          starts_at: startsAt,
          ends_at: new Date(startsAt.getTime() + HOUR_MS),
          meeting_link: `https://meet.example.com/${id}`,
        },
      });
    } catch (error) {
      // BR-4, enforced at the database level: the partial unique index on
      // appointments(consultant_id, starts_at) WHERE status = 'confirmed'
      // rejects a genuine race - two requests that both passed the check
      // above because neither had committed yet. This catch is the actual
      // guarantee; everything above it is just a nicer error message for
      // the non-racing case.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That slot has already been booked');
      }
      throw error;
    }
  }

  // F-18/F-19: "own bookings" means something different depending on which
  // side of the appointment this user is on - a client's bookings are
  // rows where they're the client, a consultant's are rows where they're
  // the consultant. RolesGuard already rejects anyone who isn't one of
  // those two roles before this runs.
  async findMine(user: { id: string; role: Role }, query: ListAppointmentsQueryDto) {
    const timeFilter =
      query.when === 'upcoming'
        ? { starts_at: { gte: new Date() } }
        : query.when === 'past'
          ? { starts_at: { lt: new Date() } }
          : {};

    if (user.role === Role.consultant) {
      const profile = await this.consultantsService.getMyProfileOrThrow(user.id);
      return this.prisma.appointment.findMany({
        where: { consultant_id: profile.id, ...timeFilter },
        orderBy: { starts_at: query.when === 'past' ? 'desc' : 'asc' },
      });
    }

    return this.prisma.appointment.findMany({
      where: { client_id: user.id, ...timeFilter },
      orderBy: { starts_at: query.when === 'past' ? 'desc' : 'asc' },
    });
  }

  async cancel(userId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { consultant: true },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // BR-7: either the booking client or the consultant may cancel -
    // ownership, not role, is what determines this. A client cancelling
    // some other client's appointment must be rejected the same as a
    // stranger would be, even though their role passed the guard.
    const isBookingClient = appointment.client_id === userId;
    const isOwningConsultant = appointment.consultant.user_id === userId;
    if (!isBookingClient && !isOwningConsultant) {
      throw new ForbiddenException('You are not authorized to cancel this appointment');
    }

    if (appointment.status === AppointmentStatus.cancelled) {
      throw new ConflictException('This appointment is already cancelled');
    }

    // BR-7/BR-8: flipping status away from 'confirmed' is what makes the
    // slot reusable - the partial unique index only constrains confirmed
    // rows, so this alone is sufficient, no separate "free up the slot"
    // step exists or is needed.
    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.cancelled, cancelled_at: new Date(), cancelled_by: userId },
    });
  }
}
