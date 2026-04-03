import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent)
  },
  {
    path: 'converter',
    canActivate: [authGuard],
    loadComponent: () => import('./features/converter/converter.component').then((m) => m.ConverterComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
