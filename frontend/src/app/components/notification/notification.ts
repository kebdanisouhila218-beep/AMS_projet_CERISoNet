import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-notification',
  imports: [CommonModule],
  templateUrl: './notification.html',
  styleUrl: './notification.css'
})
export class Notification implements OnInit {

  message: string = '';
  type: string = '';

  constructor(private authService: Auth, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.authService.message$.subscribe(msg => {
      this.message = msg;
      this.cdr.detectChanges();
    });

    this.authService.type$.subscribe(type => {
      this.type = type;
      this.cdr.detectChanges();
    });
  }
}