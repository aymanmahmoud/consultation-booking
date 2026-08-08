import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateConsultantProfileDto } from './dto/update-consultant-profile.dto';
import { UpdateConsultantSpecialtiesDto } from './dto/update-consultant-specialties.dto';

@Injectable()
export class ConsultantsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateMyProfile(userId: string, dto: UpdateConsultantProfileDto) {
    try {
      const profile = await this.prisma.consultantProfile.update({
        where: { user_id: userId },
        data: dto,
      });
      return this.toProfileSummary(profile);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        // Shouldn't happen: every consultant-role user gets a profile at
        // registration, in the same transaction. Guard anyway rather than
        // let a raw Prisma error reach the client.
        throw new NotFoundException('Consultant profile not found');
      }
      throw error;
    }
  }

  async updateMySpecialties(userId: string, dto: UpdateConsultantSpecialtiesDto) {
    const profile = await this.prisma.consultantProfile.findUnique({ where: { user_id: userId } });
    if (!profile) {
      throw new NotFoundException('Consultant profile not found');
    }

    const found = await this.prisma.specialty.findMany({
      where: { id: { in: dto.specialtyIds } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((s) => s.id));
    const unknownIds = dto.specialtyIds.filter((id) => !foundIds.has(id));
    if (unknownIds.length > 0) {
      throw new BadRequestException(`Unknown specialty id(s): ${unknownIds.join(', ')}`);
    }

    // Same replace-the-whole-set idiom as the working_hours seeding: no
    // unique constraint to upsert against per-row, so delete everything
    // for this consultant and recreate the desired set, atomically.
    await this.prisma.$transaction([
      this.prisma.consultantSpecialty.deleteMany({ where: { consultant_id: profile.id } }),
      this.prisma.consultantSpecialty.createMany({
        data: dto.specialtyIds.map((specialty_id) => ({ consultant_id: profile.id, specialty_id })),
      }),
    ]);

    return this.findPublicProfile(profile.id);
  }

  async findPublicProfile(id: string) {
    const profile = await this.prisma.consultantProfile.findUnique({
      where: { id },
      include: { specialties: { include: { specialty: true } } },
    });

    if (!profile) {
      throw new NotFoundException('Consultant not found');
    }

    return {
      ...this.toProfileSummary(profile),
      specialties: profile.specialties.map((cs) => cs.specialty),
    };
  }

  private toProfileSummary(profile: {
    id: string;
    headline: string | null;
    bio: string | null;
    price: Prisma.Decimal | null;
    is_active: boolean;
  }) {
    return {
      id: profile.id,
      headline: profile.headline,
      bio: profile.bio,
      price: profile.price,
      is_active: profile.is_active,
    };
  }
}
