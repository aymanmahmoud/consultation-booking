import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const config = { getOrThrow: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;

  function buildStrategy(userRow: unknown) {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(userRow) } } as unknown as PrismaService;
    return new JwtStrategy(config, prisma);
  }

  it('resolves to the current user for a payload whose subject still exists', async () => {
    const strategy = buildStrategy({
      id: 'user-1',
      email: 'sara@example.test',
      role: 'consultant',
      password_hash: 'should-never-be-returned',
    });

    const result = await strategy.validate({ sub: 'user-1', email: 'sara@example.test', role: 'consultant' });

    // Same shape JwtAuthGuard attaches to req.user for every protected
    // route - explicitly NOT the password hash, even though the raw
    // Prisma row (deliberately mocked with one above) has it.
    expect(result).toEqual({ id: 'user-1', email: 'sara@example.test', role: 'consultant' });
  });

  it('rejects a token whose user no longer exists', async () => {
    // The scenario the code comment calls out: a user deleted (or a token
    // forged/reused) after the JWT was issued shouldn't keep working just
    // because the signature and expiry are still valid.
    const strategy = buildStrategy(null);

    await expect(strategy.validate({ sub: 'ghost-user', email: 'x@example.test', role: 'client' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
