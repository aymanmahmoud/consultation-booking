import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Roles(Role.client)
  @Post()
  book(@CurrentUser() user: { id: string }, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.book(user.id, dto);
  }

  @Roles(Role.client, Role.consultant)
  @Get('me')
  findMine(
    @CurrentUser() user: { id: string; role: Role },
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.appointmentsService.findMine(user, query);
  }

  // No @Roles here beyond "authenticated" (JwtAuthGuard alone would do) -
  // the real authorization is ownership, checked in the service, not role
  // membership. @Roles(client, consultant) is just a coarse, cheap filter
  // that rejects e.g. an admin before any DB lookup happens.
  @Roles(Role.client, Role.consultant)
  @Patch(':id/cancel')
  cancel(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.appointmentsService.cancel(user.id, id);
  }
}
