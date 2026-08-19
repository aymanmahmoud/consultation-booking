import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Every existing page component mutates plain properties inside
    // .subscribe() callbacks (this.isLoading = false, etc.), which only
    // triggers a re-render with zone.js patching async APIs. This project
    // was scaffolded zoneless (Angular 21's default for new apps, and
    // zone.js was never in package.json/polyfills) - without this, no
    // page can ever show data after an async load completes.
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
