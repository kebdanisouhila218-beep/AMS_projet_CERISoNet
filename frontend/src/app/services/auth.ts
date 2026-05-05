import { Injectable } from '@angular/core';
import { ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Auth {

  private notificationMessage = new ReplaySubject<string>(1);
  private notificationType = new ReplaySubject<string>(1);

  message$ = this.notificationMessage.asObservable();
  type$ = this.notificationType.asObservable();

  showNotification(message: string, type: string) {
    this.notificationMessage.next(message);
    this.notificationType.next(type);

    setTimeout(() => {
      this.notificationMessage.next('');
      this.notificationType.next('');
    }, 10000);
  }
}