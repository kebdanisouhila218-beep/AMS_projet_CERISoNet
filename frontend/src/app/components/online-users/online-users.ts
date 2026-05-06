import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-online-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './online-users.html',
  styleUrl: './online-users.css'
})
export class OnlineUsersComponent {
  @Input() onlineUsers: any[] = [];
  @Input() currentUserId: any;

  get othersOnline(): any[] {
    return this.onlineUsers.filter(u => String(u.userId) !== String(this.currentUserId));
  }
}