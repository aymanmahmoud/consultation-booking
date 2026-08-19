import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.client)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  book(@CurrentUser() user: { id: string }, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.book(user.id, dto);
  }
}
