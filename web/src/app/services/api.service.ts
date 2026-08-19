import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Specialty {
  id: string;
  name: string;
}

export interface ConsultantProfile {
  id: string;
  name: string | null;
  headline: string | null;
  bio: string | null;
  // Prisma's Decimal serializes to a JSON string, not a number - keeping
  // it that way in transit is what avoids floating-point rounding on a
  // money value, not a bug to "fix" by casting to number.
  price: string | null;
  is_active: boolean;
  // The API already flattens this to Specialty[] (see
  // ConsultantsService.toProfileWithSpecialties on the backend) - it's
  // not the raw {specialty: Specialty}[] junction-row shape.
  specialties?: Specialty[];
}

interface PaginatedConsultants {
  items: ConsultantProfile[];
  total: number;
  page: number;
  limit: number;
}

export interface WorkingHourItem {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface TimeOffItem {
  id: string;
  consultant_id: string;
  starts_at: string;
  ends_at: string;
}

interface AvailabilityResponse {
  consultant_id: string;
  from: string;
  to: string;
  slots: { starts_at: string; ends_at: string }[];
}

export interface Appointment {
  id: string;
  client_id: string;
  consultant_id: string;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'cancelled';
  meeting_link: string;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  created_at: string;
  consultant?: { name: string | null };
  client?: { email: string };
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  // Specialties (Public & Admin)
  getSpecialties(): Observable<Specialty[]> {
    return this.http.get<Specialty[]>(`${this.baseUrl}/specialties`);
  }

  createSpecialty(name: string): Observable<Specialty> {
    return this.http.post<Specialty>(`${this.baseUrl}/specialties`, { name });
  }

  updateSpecialty(id: string, name: string): Observable<Specialty> {
    return this.http.patch<Specialty>(`${this.baseUrl}/specialties/${id}`, { name });
  }

  deleteSpecialty(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/specialties/${id}`);
  }

  // Consultants
  getConsultants(params?: { specialtyId?: string; search?: string }): Observable<ConsultantProfile[]> {
    let httpParams = new HttpParams();
    if (params?.specialtyId) {
      httpParams = httpParams.set('specialtyId', params.specialtyId);
    }
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }
    // GET /consultants is paginated ({items, total, page, limit}), not a
    // bare array - unwrap it here so every existing caller (which was
    // written against a flat array) keeps working unchanged.
    return this.http
      .get<PaginatedConsultants>(`${this.baseUrl}/consultants`, { params: httpParams })
      .pipe(map((res) => res.items));
  }

  getConsultantById(id: string): Observable<ConsultantProfile> {
    return this.http.get<ConsultantProfile>(`${this.baseUrl}/consultants/${id}`);
  }

  getMyConsultantProfile(): Observable<ConsultantProfile> {
    return this.http.get<ConsultantProfile>(`${this.baseUrl}/consultants/me`);
  }

  updateMyProfile(payload: {
    name?: string;
    headline?: string;
    bio?: string;
    price?: number;
  }): Observable<ConsultantProfile> {
    return this.http.patch<ConsultantProfile>(`${this.baseUrl}/consultants/me`, payload);
  }

  updateMySpecialties(specialtyIds: string[]): Observable<ConsultantProfile> {
    return this.http.put<ConsultantProfile>(`${this.baseUrl}/consultants/me/specialties`, {
      specialtyIds,
    });
  }

  // Working Hours & Time Off
  getMyWorkingHours(): Observable<WorkingHourItem[]> {
    return this.http.get<WorkingHourItem[]>(`${this.baseUrl}/consultants/me/working-hours`);
  }

  replaceMyWorkingHours(workingHours: WorkingHourItem[]): Observable<WorkingHourItem[]> {
    return this.http.put<WorkingHourItem[]>(`${this.baseUrl}/consultants/me/working-hours`, {
      workingHours,
    });
  }

  getMyTimeOff(): Observable<TimeOffItem[]> {
    return this.http.get<TimeOffItem[]>(`${this.baseUrl}/consultants/me/time-off`);
  }

  createTimeOff(payload: { starts_at: string; ends_at: string }): Observable<TimeOffItem> {
    return this.http.post<TimeOffItem>(`${this.baseUrl}/consultants/me/time-off`, payload);
  }

  deleteTimeOff(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/consultants/me/time-off/${id}`);
  }

  // Availability & Appointments
  getConsultantAvailability(id: string, from: string, to: string): Observable<string[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    // The API returns {consultant_id, from, to, slots: [{starts_at, ends_at}]},
    // not a bare array - unwrap to just the start times, which is the
    // shape every existing caller (slot picker) already expects.
    return this.http
      .get<AvailabilityResponse>(`${this.baseUrl}/consultants/${id}/availability`, { params })
      .pipe(map((res) => res.slots.map((slot) => slot.starts_at)));
  }

  bookAppointment(consultant_id: string, starts_at: string): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/appointments`, {
      consultant_id,
      starts_at,
    });
  }

  getMyAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.baseUrl}/appointments/me`);
  }

  cancelAppointment(id: string): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.baseUrl}/appointments/${id}/cancel`, {});
  }
}
