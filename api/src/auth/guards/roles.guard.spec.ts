import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../generated/prisma/client';
import { RolesGuard } from './roles.guard';

function createContext(user: { role: string } | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows the request when the route has no @Roles metadata', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });

  it('allows a user whose role is in the required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.admin]);
    expect(guard.canActivate(createContext({ role: Role.admin }))).toBe(true);
  });

  it('rejects a user whose role is not in the required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.admin]);
    expect(() => guard.canActivate(createContext({ role: Role.client }))).toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user on the request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.admin]);
    expect(() => guard.canActivate(createContext(undefined))).toThrow(ForbiddenException);
  });
});
