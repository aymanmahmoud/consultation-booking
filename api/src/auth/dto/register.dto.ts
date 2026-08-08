import { IsEmail, IsIn, MinLength } from 'class-validator';
import { Role } from '../../../generated/prisma/client';

// Only client/consultant may self-register (F-01, F-02). Admin accounts
// are provisioned separately (seeded, or created by another admin later),
// never through this public endpoint.
export type RegisterableRole = typeof Role.client | typeof Role.consultant;

export class RegisterDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;

  @IsIn([Role.client, Role.consultant])
  role: RegisterableRole;
}
