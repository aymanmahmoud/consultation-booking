import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.specialty.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateSpecialtyDto) {
    try {
      return await this.prisma.specialty.create({ data: { name: dto.name } });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async update(id: string, dto: UpdateSpecialtyDto) {
    try {
      return await this.prisma.specialty.update({ where: { id }, data: { name: dto.name } });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.specialty.delete({ where: { id } });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new ConflictException('A specialty with that name already exists');
      }
      if (error.code === 'P2025') {
        return new NotFoundException('Specialty not found');
      }
    }
    return error;
  }
}
