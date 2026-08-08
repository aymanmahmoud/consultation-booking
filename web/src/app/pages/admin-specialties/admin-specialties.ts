import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Specialty } from '../../services/api.service';

@Component({
  selector: 'app-admin-specialties',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-specialties.html',
  styleUrl: './admin-specialties.scss',
})
export class AdminSpecialtiesComponent implements OnInit {
  specialties: Specialty[] = [];
  newSpecialtyName = '';
  editingId: string | null = null;
  editingName = '';

  isLoading = true;
  isAdding = false;
  successMessage = '';
  errorMessage = '';

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadSpecialties();
  }

  loadSpecialties(): void {
    this.isLoading = true;
    this.apiService.getSpecialties().subscribe({
      next: (data) => {
        this.specialties = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load specialties', err);
        this.isLoading = false;
      },
    });
  }

  addSpecialty(): void {
    if (!this.newSpecialtyName.trim()) return;

    this.isAdding = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.apiService.createSpecialty(this.newSpecialtyName.trim()).subscribe({
      next: () => {
        this.isAdding = false;
        this.newSpecialtyName = '';
        this.successMessage = 'Specialty created successfully!';
        this.loadSpecialties();
      },
      error: (err) => {
        this.isAdding = false;
        this.errorMessage = err.error?.message || 'Failed to create specialty.';
      },
    });
  }

  startEdit(specialty: Specialty): void {
    this.editingId = specialty.id;
    this.editingName = specialty.name;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editingName = '';
  }

  saveEdit(id: string): void {
    if (!this.editingName.trim()) return;

    this.apiService.updateSpecialty(id, this.editingName.trim()).subscribe({
      next: () => {
        this.editingId = null;
        this.loadSpecialties();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to update specialty.';
      },
    });
  }

  deleteSpecialty(id: string): void {
    if (!confirm('Are you sure you want to delete this specialty?')) return;

    this.apiService.deleteSpecialty(id).subscribe({
      next: () => this.loadSpecialties(),
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to delete specialty.';
      },
    });
  }
}
