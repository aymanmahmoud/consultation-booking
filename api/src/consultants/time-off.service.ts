import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultantsService } from './consultants.service';
import { CreateTimeOffDto } from './dto/create-time-off.dto';

@Injectable()
export class TimeOffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consultantsService: ConsultantsService,
  ) {}

  async findMine(userId: string) {
    const profile = await this.consultantsService.getMyProfileOrThrow(userId);
    return this.prisma.timeOff.findMany({
      where: { consultant_id: profile.id },
      orderBy: { starts_at: 'asc' },
    });
  }

  async createMine(userId: string, dto: CreateTimeOffDto) {
    const profile = await this.consultantsService.getMyProfileOrThrow(userId);

    if (dto.starts_at >= dto.ends_at) {
      throw new BadRequestException('ends_at must be after starts_at');
    }

    return this.prisma.timeOff.create({
      data: {
        consultant_id: profile.id,
        starts_at: dto.starts_at,
        ends_at: dto.ends_at,
      },
    });
  }

  async removeMine(userId: string, id: string) {
    const profile = await this.consultantsService.getMyProfileOrThrow(userId);

    // Scope the delete to this consultant's own rows in the WHERE clause
    // itself, not as a separate ownership check after an unscoped lookup -
    // that's what stops consultant A from deleting consultant B's time off
    // by guessing an id. Same response either way (404), so the endpoint
    // never reveals whether the id belongs to someone else or doesn't exist.
    const { count } = await this.prisma.timeOff.deleteMany({
      where: { id, consultant_id: profile.id },
    });

    if (count === 0) {
      throw new NotFoundException('Time off entry not found');
    }
  }
}
