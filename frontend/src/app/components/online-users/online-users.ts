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
  // Liste des utilisateurs connectés reçue depuis Wall
  @Input() onlineUsers: any[] = [];
  // ID de l'utilisateur connecté pour ne pas s'afficher soi-même
  @Input() currentUserId: any;
}