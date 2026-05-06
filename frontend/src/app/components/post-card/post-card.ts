import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../services/post';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css'
})
export class PostCardComponent {
  // Le post reçu depuis Wall
  @Input() post: any;
  // L'ID de l'utilisateur connecté
  @Input() currentUserId: any;

  // Événements envoyés vers Wall
  @Output() likeToggled = new EventEmitter<any>();
  @Output() commentAdded = new EventEmitter<any>();

  // Injection du service pour accéder à getUserPseudo
  constructor(public postService: PostService) {}

  // Émet l'événement like vers Wall
  onLike(): void {
    this.likeToggled.emit(this.post);
  }

  // Émet l'événement commentaire vers Wall
  onComment(): void {
    if (!this.post.commentText || !this.post.commentText.trim()) return;
    this.commentAdded.emit(this.post);
  }
}