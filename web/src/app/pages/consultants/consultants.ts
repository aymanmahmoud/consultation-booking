import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, ConsultantProfile, Specialty } from '../../services/api.service';

@Component({
  selector: 'app-consultants',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './consultants.html',
  styleUrl: './consultants.scss',
})
export class ConsultantsComponent implements OnInit {
  consultants: ConsultantProfile[] = [];
  specialties: Specialty[] = [];
  selectedSpecialtyId: string | null = null;
  searchQuery = '';
  isLoading = true;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadSpecialties();
    this.loadConsultants();
  }

  loadSpecialties(): void {
    this.apiService.getSpecialties().subscribe({
      next: (data) => (this.specialties = data),
      error: (err) => console.error('Failed to load specialties', err),
    });
  }

  loadConsultants(): void {
    this.isLoading = true;
    this.apiService
      .getConsultants({
        specialtyId: this.selectedSpecialtyId || undefined,
        search: this.searchQuery || undefined,
      })
      .subscribe({
        next: (data) => {
          this.consultants = data;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load consultants', err);
          this.isLoading = false;
        },
      });
  }

  selectSpecialty(specialtyId: string | null): void {
    this.selectedSpecialtyId = specialtyId;
    this.loadConsultants();
  }

  onSearch(): void {
    this.loadConsultants();
  }
}
