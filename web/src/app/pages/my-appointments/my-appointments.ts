import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Appointment } from '../../services/api.service';

@Component({
  selector: 'app-my-appointments',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-appointments.html',
  styleUrl: './my-appointments.scss',
})
export class MyAppointmentsComponent implements OnInit {
  appointments: Appointment[] = [];
  activeTab: 'upcoming' | 'past' = 'upcoming';
  isLoading = true;
  cancellingId: string | null = null;
  cancelError = '';
  loadError = '';

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadAppointments();
  }

  loadAppointments(): void {
    this.isLoading = true;
    this.loadError = '';
    this.apiService.getMyAppointments().subscribe({
      next: (data) => {
        this.appointments = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load appointments', err);
        this.isLoading = false;
        this.loadError = 'Failed to load your appointments. Please try again.';
      },
    });
  }

  get filteredAppointments(): Appointment[] {
    const now = new Date();
    if (this.activeTab === 'upcoming') {
      return this.appointments.filter(
        (a) => a.status === 'confirmed' && new Date(a.starts_at) >= now
      );
    } else {
      return this.appointments.filter(
        (a) => a.status === 'cancelled' || new Date(a.starts_at) < now
      );
    }
  }

  cancelAppointment(id: string): void {
    if (!confirm('Are you sure you want to cancel this appointment? The slot will immediately become bookable again.')) {
      return;
    }

    this.cancellingId = id;
    this.cancelError = '';

    this.apiService.cancelAppointment(id).subscribe({
      next: () => {
        this.cancellingId = null;
        this.loadAppointments();
      },
      error: (err) => {
        this.cancellingId = null;
        this.cancelError = err.error?.message || 'Failed to cancel appointment.';
      },
    });
  }

  formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
}
