import { SetMetadata } from '@nestjs/common';
import { Role } from '../../../generated/prisma/client';

export const ROLES_KEY = 'roles';

// Attaches allowed roles as route metadata; RolesGuard reads it back with
// Reflector. No metadata on a route means "any authenticated role" -
// RolesGuard only restricts routes that opt in.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
