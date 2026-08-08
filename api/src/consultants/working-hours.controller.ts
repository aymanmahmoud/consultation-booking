import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReplaceWorkingHoursDto } from './dto/working-hours.dto';
import { WorkingHoursService } from './working-hours.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.consultant)
@Controller('consultants/me/working-hours')
export class WorkingHoursController {
  constructor(private readonly workingHoursService: WorkingHoursService) {}

  @Get()
  findMine(@CurrentUser() user: { id: string }) {
    return this.workingHoursService.findMine(user.id);
  }

  @Put()
  replaceMine(@CurrentUser() user: { id: string }, @Body() dto: ReplaceWorkingHoursDto) {
    return this.workingHoursService.replaceMine(user.id, dto);
  }
}
