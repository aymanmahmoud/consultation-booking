import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ConsultantsService } from './consultants.service';
import { UpdateConsultantProfileDto } from './dto/update-consultant-profile.dto';

@Controller('consultants')
export class ConsultantsController {
  constructor(private readonly consultantsService: ConsultantsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.consultant)
  @Patch('me')
  updateMyProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateConsultantProfileDto) {
    return this.consultantsService.updateMyProfile(user.id, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.consultantsService.findPublicProfile(id);
  }
}
