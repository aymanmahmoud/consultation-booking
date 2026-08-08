import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, TimeOffItem, WorkingHourItem } from '../../services/api.service';

interface DayScheduleRow {
  day_of_week: number;
  day_name: string;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

@Component({
  selector: 'app-consultant-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consultant-schedule.html',
  styleUrl: './consultant-schedule.scss',
})
export class ConsultantScheduleComponent implements OnInit {
  days: DayScheduleRow[] = [
    { day_of_week: 1, day_name: 'Monday', enabled: true, start_time: '09:00', end_time: '17:00' },
    { day_of_week: 2, day_name: 'Tuesday', enabled: true, start_time: '09:00', end_time: '17:00' },
    { day_of_week: 3, day_name: 'Wednesday', enabled: true, start_time: '09:00', end_time: '17:00' },
    { day_of_week: 4, day_name: 'Thursday', enabled: true, start_time: '09:00', end_time: '17:00' },
    { day_of_week: 5, day_name: 'Friday', enabled: true, start_time: '09:00', end_time: '17:00' },
    { day_of_week: 6, day_name: 'Saturday', enabled: false, start_time: '09:00', end_time: '17:00' },
    { day_of_week: 0, day_name: 'Sunday', enabled: false, start_time: '09:00', end_time: '17:00' },
  ];

  timeOptions = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
  ];

  timeOffList: TimeOffItem[] = [];
  newTimeOffStart = '';
  newTimeOffEnd = '';

  isLoadingHours = true;
  isLoadingTimeOff = true;
  isSavingHours = false;
  isAddingTimeOff = false;

  hoursMessage = '';
  hoursError = '';
  timeOffError = '';

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadWorkingHours();
    this.loadTimeOff();
  }

  loadWorkingHours(): void {
    this.isLoadingHours = true;
    this.apiService.getMyWorkingHours().subscribe({
      next: (existing) => {
        if (existing && existing.length > 0) {
          this.days.forEach((day) => {
            const match = existing.find((e) => e.day_of_week === day.day_of_week);
            if (match) {
              day.enabled = true;
              day.start_time = match.start_time;
              day.end_time = match.end_time;
            } else {
              day.enabled = false;
            }
          });
        }
        this.isLoadingHours = false;
      },
      error: (err) => {
        console.error('Failed to load working hours', err);
        this.isLoadingHours = false;
      },
    });
  }

  saveWorkingHours(): void {
    this.isSavingHours = true;
    this.hoursMessage = '';
    this.hoursError = '';

    const payload: WorkingHourItem[] = this.days
      .filter((d) => d.enabled)
      .map((d) => ({
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
      }));

    this.apiService.replaceMyWorkingHours(payload).subscribe({
      next: () => {
        this.isSavingHours = false;
        this.hoursMessage = 'Weekly working hours updated successfully!';
      },
      error: (err) => {
        this.isSavingHours = false;
        this.hoursError = err.error?.message || 'Failed to save working hours.';
      },
    });
  }

  loadTimeOff(): void {
    this.isLoadingTimeOff = true;
    this.apiService.getMyTimeOff().subscribe({
      next: (list) => {
        this.timeOffList = list;
        this.isLoadingTimeOff = false;
      },
      error: (err) => {
        console.error('Failed to load time off', err);
        this.isLoadingTimeOff = false;
      },
    });
  }

  addTimeOff(): void {
    if (!this.newTimeOffStart || !this.newTimeOffEnd) {
      this.timeOffError = 'Please select both start and end date/time.';
      return;
    }

    this.isAddingTimeOff = true;
    this.timeOffError = '';

    const starts_at = new Date(this.newTimeOffStart).toISOString();
    const ends_at = new Date(this.newTimeOffEnd).toISOString();

    this.apiService.createTimeOff({ starts_at, ends_at }).subscribe({
      next: () => {
        this.isAddingTimeOff = false;
        this.newTimeOffStart = '';
        this.newTimeOffEnd = '';
        this.loadTimeOff();
      },
      error: (err) => {
        this.isAddingTimeOff = false;
        this.timeOffError = err.error?.message || 'Failed to add time off.';
      },
    });
  }

  deleteTimeOff(id: string): void {
    this.apiService.deleteTimeOff(id).subscribe({
      next: () => this.loadTimeOff(),
      error: (err) => console.error('Failed to delete time off', err),
    });
  }
}
