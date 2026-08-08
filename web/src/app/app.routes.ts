import { Routes } from '@angular/router';
import { ConsultantsComponent } from './pages/consultants/consultants';
import { ConsultantDetailComponent } from './pages/consultant-detail/consultant-detail';
import { LoginComponent } from './pages/login/login';
import { RegisterComponent } from './pages/register/register';
import { MyAppointmentsComponent } from './pages/my-appointments/my-appointments';
import { ConsultantScheduleComponent } from './pages/consultant-schedule/consultant-schedule';
import { ConsultantProfileComponent } from './pages/consultant-profile/consultant-profile';
import { AdminSpecialtiesComponent } from './pages/admin-specialties/admin-specialties';

export const routes: Routes = [
  { path: '', redirectTo: 'consultants', pathMatch: 'full' },
  { path: 'consultants', component: ConsultantsComponent },
  { path: 'consultants/me/schedule', component: ConsultantScheduleComponent },
  { path: 'consultants/me/profile', component: ConsultantProfileComponent },
  { path: 'consultants/:id', component: ConsultantDetailComponent },
  { path: 'admin/specialties', component: AdminSpecialtiesComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'appointments', component: MyAppointmentsComponent },
  { path: '**', redirectTo: 'consultants' },
];
