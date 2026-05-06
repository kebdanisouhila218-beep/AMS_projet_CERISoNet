import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-online-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './online-users.html',
  styleUrl: './online-users.css'
})
export class OnlineUsersComponent implements OnChanges {
  @Input() onlineUsers: any[] = [];
  @Input() currentUserId: any;

  othersOnline: any[] = [];

  ngOnChanges(): void {
    // Recalculé à chaque changement de liste OU de currentUserId
    this.othersOnline = this.onlineUsers.filter(
      u => String(u.userId) !== String(this.currentUserId)
    );
  }
}