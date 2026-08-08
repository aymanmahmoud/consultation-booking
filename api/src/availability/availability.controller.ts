import { Controller, Get, Param, Query } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { GetAvailabilityQueryDto } from './dto/get-availability-query.dto';

@Controller('consultants')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get(':id/availability')
  getAvailability(@Param('id') id: string, @Query() query: GetAvailabilityQueryDto) {
    return this.availabilityService.getAvailability(id, query);
  }
}
