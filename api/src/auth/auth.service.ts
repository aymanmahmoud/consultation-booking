import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const PASSWORD_HASH_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const password_hash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);

    try {
      // One transaction: a consultant's User and ConsultantProfile either
      // both exist or neither does. Without this, a crash between the two
      // inserts would leave a consultant-role user with no profile.
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email: dto.email, password_hash, role: dto.role },
        });

        if (dto.role === Role.consultant) {
          await tx.consultantProfile.create({ data: { user_id: created.id } });
        }

        return created;
      });

      return this.toPublicUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Same error for "no such user" and "wrong password" - telling them
    // apart would let an attacker enumerate which emails are registered.
    if (!user || !(await bcrypt.compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const access_token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { access_token };
  }

  private toPublicUser(user: { id: string; email: string; role: string; created_at: Date }) {
    const { id, email, role, created_at } = user;
    return { id, email, role, created_at };
  }
}
