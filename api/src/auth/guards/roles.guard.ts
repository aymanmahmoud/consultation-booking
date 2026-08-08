import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../generated/prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Reads req.user.role, set by JwtStrategy.validate(). Must be used AFTER
// JwtAuthGuard in the guard list - e.g. @UseGuards(JwtAuthGuard, RolesGuard) -
// since Nest runs guards in array order and there's no user to check yet
// until the JWT guard has run.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }

    return true;
  }
}
