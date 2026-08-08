import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class RegisterComponent {
  email = '';
  password = '';
  role: 'client' | 'consultant' = 'client';
  errorMessage = '';
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters long.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register({ email: this.email, password: this.password, role: this.role }).subscribe({
      next: () => {
        // Automatically sign in after successful registration
        this.authService.login({ email: this.email, password: this.password }).subscribe({
          next: () => {
            this.isLoading = false;
            this.router.navigate(['/consultants']);
          },
          error: () => {
            this.isLoading = false;
            this.router.navigate(['/login']);
          },
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Registration failed. Email may already be registered.';
      },
    });
  }
}
