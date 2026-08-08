import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTimeOffDto } from './dto/create-time-off.dto';
import { TimeOffService } from './time-off.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.consultant)
@Controller('consultants/me/time-off')
export class TimeOffController {
  constructor(private readonly timeOffService: TimeOffService) {}

  @Get()
  findMine(@CurrentUser() user: { id: string }) {
    return this.timeOffService.findMine(user.id);
  }

  @Post()
  createMine(@CurrentUser() user: { id: string }, @Body() dto: CreateTimeOffDto) {
    return this.timeOffService.createMine(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMine(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.timeOffService.removeMine(user.id, id);
  }
}
