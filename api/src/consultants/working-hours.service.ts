import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultantsService } from './consultants.service';
import { ReplaceWorkingHoursDto } from './dto/working-hours.dto';

function hourStringToDate(hhmm: string): Date {
  // Same convention as the seed script: @db.Time only keeps the
  // time-of-day, but Prisma still needs a full Date to send it.
  const [hour] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hour, 0, 0));
}

function dateToHourString(date: Date): string {
  return `${date.getUTCHours().toString().padStart(2, '0')}:00`;
}

@Injectable()
export class WorkingHoursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consultantsService: ConsultantsService,
  ) {}

  async findMine(userId: string) {
    const profile = await this.consultantsService.getMyProfileOrThrow(userId);
    const rows = await this.prisma.workingHours.findMany({
      where: { consultant_id: profile.id },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });
    return rows.map((row) => ({
      day_of_week: row.day_of_week,
      start_time: dateToHourString(row.start_time),
      end_time: dateToHourString(row.end_time),
    }));
  }

  async replaceMine(userId: string, dto: ReplaceWorkingHoursDto) {
    const profile = await this.consultantsService.getMyProfileOrThrow(userId);

    for (const block of dto.workingHours) {
      if (block.start_time >= block.end_time) {
        throw new BadRequestException(
          `end_time must be after start_time for day_of_week ${block.day_of_week} (got ${block.start_time}-${block.end_time})`,
        );
      }
    }

    // Same replace-the-whole-set idiom used for specialties and in the
    // seed script: no per-row unique constraint to upsert against, so
    // delete everything for this consultant and recreate atomically.
    await this.prisma.$transaction([
      this.prisma.workingHours.deleteMany({ where: { consultant_id: profile.id } }),
      this.prisma.workingHours.createMany({
        data: dto.workingHours.map((block) => ({
          consultant_id: profile.id,
          day_of_week: block.day_of_week,
          start_time: hourStringToDate(block.start_time),
          end_time: hourStringToDate(block.end_time),
        })),
      }),
    ]);

    return this.findMine(userId);
  }
}
