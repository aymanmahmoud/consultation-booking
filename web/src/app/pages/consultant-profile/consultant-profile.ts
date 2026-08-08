import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Specialty } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-consultant-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consultant-profile.html',
  styleUrl: './consultant-profile.scss',
})
export class ConsultantProfileComponent implements OnInit {
  headline = '';
  bio = '';
  price: number | null = 45;

  allSpecialties: Specialty[] = [];
  selectedSpecialtyIds: string[] = [];

  isLoading = true;
  isSaving = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;

    this.apiService.getSpecialties().subscribe({
      next: (specs) => {
        this.allSpecialties = specs;

        // Fetch consultant profile
        const user = this.authService.currentUser();
        if (user) {
          this.apiService.getConsultants().subscribe({
            next: (list) => {
              const myProf = list.find((c) => c.user_id === user.id);
              if (myProf) {
                this.headline = myProf.headline || '';
                this.bio = myProf.bio || '';
                this.price = myProf.price;
                this.selectedSpecialtyIds = myProf.specialties?.map((s) => s.specialty.id) || [];
              }
              this.isLoading = false;
            },
            error: () => (this.isLoading = false),
          });
        } else {
          this.isLoading = false;
        }
      },
      error: () => (this.isLoading = false),
    });
  }

  toggleSpecialty(id: string): void {
    if (this.selectedSpecialtyIds.includes(id)) {
      this.selectedSpecialtyIds = this.selectedSpecialtyIds.filter((sId) => sId !== id);
    } else {
      this.selectedSpecialtyIds.push(id);
    }
  }

  isSpecialtySelected(id: string): boolean {
    return this.selectedSpecialtyIds.includes(id);
  }

  onSubmit(): void {
    this.isSaving = true;
    this.successMessage = '';
    this.errorMessage = '';

    // Update basic profile fields
    this.apiService
      .updateMyProfile({
        headline: this.headline,
        bio: this.bio,
        price: this.price || 0,
      })
      .subscribe({
        next: () => {
          // Update specialties assignment
          this.apiService.updateMySpecialties(this.selectedSpecialtyIds).subscribe({
            next: () => {
              this.isSaving = false;
              this.successMessage = 'Profile & Specialties updated successfully!';
            },
            error: (err) => {
              this.isSaving = false;
              this.errorMessage = err.error?.message || 'Failed to update specialties.';
            },
          });
        },
        error: (err) => {
          this.isSaving = false;
          this.errorMessage = err.error?.message || 'Failed to update profile details.';
        },
      });
  }
}
