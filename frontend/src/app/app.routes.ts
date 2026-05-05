import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Wall } from './components/wall/wall';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'wall', component: Wall }
];