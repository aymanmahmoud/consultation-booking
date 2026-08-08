import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListConsultantsQueryDto } from './dto/list-consultants-query.dto';
import { UpdateConsultantProfileDto } from './dto/update-consultant-profile.dto';
import { UpdateConsultantSpecialtiesDto } from './dto/update-consultant-specialties.dto';

const SPECIALTIES_INCLUDE = { specialties: { include: { specialty: true } } } as const;

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
      include: SPECIALTIES_INCLUDE,
    });

    if (!profile) {
      throw new NotFoundException('Consultant not found');
    }

    return this.toProfileWithSpecialties(profile);
  }

  // F-11/F-12/F-13: paginated, specialty-filterable, name/headline search.
  // is_active: true is NOT one of the optional filters - it's always
  // applied, per BR-10 ("does not appear in search"). There's no way for
  // a caller to opt out of it on this public endpoint.
  async findAll(query: ListConsultantsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.ConsultantProfileWhereInput = { is_active: true };

    if (query.specialtyId) {
      where.specialties = { some: { specialty_id: query.specialtyId } };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { headline: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [profiles, total] = await this.prisma.$transaction([
      this.prisma.consultantProfile.findMany({
        where,
        include: SPECIALTIES_INCLUDE,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.consultantProfile.count({ where }),
    ]);

    return {
      items: profiles.map((profile) => this.toProfileWithSpecialties(profile)),
      total,
      page,
      limit,
    };
  }

  private toProfileWithSpecialties(profile: {
    id: string;
    name: string | null;
    headline: string | null;
    bio: string | null;
    price: Prisma.Decimal | null;
    is_active: boolean;
    specialties: { specialty: { id: string; name: string } }[];
  }) {
    return {
      ...this.toProfileSummary(profile),
      specialties: profile.specialties.map((cs) => cs.specialty),
    };
  }

  private toProfileSummary(profile: {
    id: string;
    name: string | null;
    headline: string | null;
    bio: string | null;
    price: Prisma.Decimal | null;
    is_active: boolean;
  }) {
    return {
      id: profile.id,
      name: profile.name,
      headline: profile.headline,
      bio: profile.bio,
      price: profile.price,
      is_active: profile.is_active,
    };
  }
}
