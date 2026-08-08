import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, Appointment, ConsultantProfile } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-consultant-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './consultant-detail.html',
  styleUrl: './consultant-detail.scss',
})
export class ConsultantDetailComponent implements OnInit {
  @Input() id!: string;

  consultant: ConsultantProfile | null = null;
  availableSlots: string[] = [];
  selectedDate: string = this.getTodayIso();
  selectedSlot: string | null = null;

  isLoading = true;
  isLoadingSlots = false;
  isBooking = false;
  bookingError = '';
  confirmedAppointment: Appointment | null = null;

  // Next 7 days selector
  availableDays: { dateIso: string; label: string; dayName: string }[] = [];

  constructor(
    private apiService: ApiService,
    public authService: AuthService,
    private router: Router
  ) {
    this.generateDaysList();
  }

  ngOnInit(): void {
    if (this.id) {
      this.loadConsultant();
      this.loadAvailability(this.selectedDate);
    }
  }

  generateDaysList(): void {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      const dateIso = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      days.push({ dateIso, dayName, label });
    }
    this.availableDays = days;
  }

  getTodayIso(): string {
    return new Date().toISOString().split('T')[0];
  }

  loadConsultant(): void {
    this.apiService.getConsultantById(this.id).subscribe({
      next: (data) => {
        this.consultant = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to fetch consultant details', err);
        this.isLoading = false;
      },
    });
  }

  loadAvailability(dateIso: string): void {
    this.selectedDate = dateIso;
    this.selectedSlot = null;
    this.isLoadingSlots = true;

    // Availability for 1 day: from=dateIso to=dateIso
    this.apiService.getConsultantAvailability(this.id, dateIso, dateIso).subscribe({
      next: (slots) => {
        this.availableSlots = slots;
        this.isLoadingSlots = false;
      },
      error: (err) => {
        console.error('Failed to load slots', err);
        this.isLoadingSlots = false;
      },
    });
  }

  selectSlot(slotIso: string): void {
    this.selectedSlot = slotIso;
    this.bookingError = '';
  }

  confirmBooking(): void {
    if (!this.authService.currentUser()) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.selectedSlot) return;

    this.isBooking = true;
    this.bookingError = '';

    this.apiService.bookAppointment(this.id, this.selectedSlot).subscribe({
      next: (appointment) => {
        this.isBooking = false;
        this.confirmedAppointment = appointment;
      },
      error: (err) => {
        this.isBooking = false;
        if (err.status === 409) {
          this.bookingError = 'This time slot was just booked by another client. Please select another slot.';
          this.loadAvailability(this.selectedDate);
        } else {
          this.bookingError = err.error?.message || 'Failed to book appointment. Please try again.';
        }
      },
    });
  }

  formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
}
