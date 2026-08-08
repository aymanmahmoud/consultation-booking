import { Module } from '@nestjs/common';
import { ConsultantsController } from './consultants.controller';
import { ConsultantsService } from './consultants.service';
import { TimeOffController } from './time-off.controller';
import { TimeOffService } from './time-off.service';
import { WorkingHoursController } from './working-hours.controller';
import { WorkingHoursService } from './working-hours.service';

@Module({
  controllers: [ConsultantsController, WorkingHoursController, TimeOffController],
  providers: [ConsultantsService, WorkingHoursService, TimeOffService],
})
export class ConsultantsModule {}
