import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface User {
  id: string;
  email: string;
  role: 'client' | 'consultant' | 'admin';
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
}

const TOKEN_KEY = 'consult_auth_token';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/auth';
  
  // Angular Signal for reactive current user state
  currentUser = signal<User | null>(null);

  constructor(private http: HttpClient) {
    this.loadUserFromToken();
  }

  login(credentials: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((res) => {
        this.saveToken(res.access_token);
        this.fetchProfile().subscribe();
      })
    );
  }

  register(payload: { email: string; password: string; role: 'client' | 'consultant' }): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/register`, payload);
  }

  fetchProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      tap((user) => this.currentUser.set(user))
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  private loadUserFromToken(): void {
    const token = this.getToken();
    if (token) {
      this.fetchProfile().subscribe({
        error: () => this.logout(),
      });
    }
  }
}
