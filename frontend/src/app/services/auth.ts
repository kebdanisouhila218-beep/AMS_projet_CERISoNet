import { Injectable } from '@angular/core';
import { ReplaySubject, BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class Auth {
//radio dernier valeur
  private notificationMessage = new ReplaySubject<string>(1);
  private notificationType = new ReplaySubject<string>(1);
  message$ = this.notificationMessage.asObservable();
  //listen only
  type$ = this.notificationType.asObservable();

  private _userId = new BehaviorSubject<string>('Inconnu');
  userId$ = this._userId.asObservable();

  get currentUserId(): string {
    return this._userId.getValue();
  }

  constructor(private http: HttpClient, private router: Router) {}

  showNotification(message: string, type: string) {
    this.notificationMessage.next(message);
    this.notificationType.next(type);
    setTimeout(() => {
      this.notificationMessage.next('');
      this.notificationType.next('');
    }, 10000);
  }

  loadSession(websocketService: any): void {
    const derniereConnexion = localStorage.getItem('derniereConnexion');
    if (!derniereConnexion) {
      this.router.navigate(['/login']);
      return;
    }

    this.http.get<any>('https://pedago.univ-avignon.fr:3170/test-session', { withCredentials: true })
      .subscribe({
        next: (data) => {
          if (!data.isConnected) {
            localStorage.removeItem('derniereConnexion');
            this.router.navigate(['/login']);
            return;
          }

          this._userId.next(data.userId || 'Inconnu');

          if (data.userId) {
            // identify() recrée un socket propre et envoie userConnected
            websocketService.identify(data.userId, data.userPseudo || 'Utilisateur');
          }
        },
        error: () => {
          localStorage.removeItem('derniereConnexion');
          this.router.navigate(['/login']);
        }
      });
  }

  checkSession(): void {
    this.http.get<any>('https://pedago.univ-avignon.fr:3170/test-session', { withCredentials: true })
      .subscribe({
        next: (data) => {
          if (!data.isConnected) {
            localStorage.removeItem('derniereConnexion');
            this.router.navigate(['/login']);
          }
        },
        error: () => {
          localStorage.removeItem('derniereConnexion');
          this.router.navigate(['/login']);
        }
      });
  }

  logout(): void {
    localStorage.removeItem('derniereConnexion');
    this.http.get<any>('https://pedago.univ-avignon.fr:3170/logout', { withCredentials: true })
      .subscribe({
        next: () => this.router.navigate(['/login']),
        error: () => this.router.navigate(['/login'])
      });
  }
}