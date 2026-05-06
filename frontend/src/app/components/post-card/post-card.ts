import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../services/post';
import { Auth } from '../../services/auth';
import { WebsocketService } from '../../services/websocket.service';

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

  constructor(
    public postService: PostService,
    private authService: Auth,
    private websocketService: WebsocketService
  ) {}

  // Gère le like directement sans passer par Wall
  onLike(): void {
    this.postService.toggleLike(this.post._id).subscribe((data: any) => {
      if (data.success) {
        this.post.userHasLiked = data.liked;
        this.post.totalLikes = data.totalLikes;
        const action = data.liked ? 'liké' : 'n\'a plus liké';
        this.authService.showNotification(`Tu as ${action} ce post`, 'success');
        this.websocketService.notifyPostLiked({
          postId: this.post._id,
          userId: this.currentUserId,
          userPseudo: localStorage.getItem('userPseudo') || 'Utilisateur',
          liked: data.liked,
          totalLikes: data.totalLikes
        });
      } else {
        this.authService.showNotification('Erreur : ' + data.message, 'error');
      }
    });
  }

  // Gère le commentaire directement sans passer par Wall
  onComment(): void {
    if (!this.post.commentText?.trim()) return;
    this.postService.addComment(this.post._id, this.post.commentText.trim())
      .subscribe({
        next: (data: any) => {
          if (data.success) {
            this.post.commentText = '';
            this.post.comments = [...(this.post.comments || []), data.comment];
            this.authService.showNotification('Commentaire ajouté', 'success');
            this.websocketService.notifyNewComment({
              postId: this.post._id,
              comment: data.comment,
              authorPseudo: this.postService.getUserPseudo(data.comment.commentedBy)
            });
          } else {
            this.authService.showNotification('Erreur : ' + (data.message || 'Erreur inconnue'), 'error');
          }
        },
        error: (err) => {
          this.authService.showNotification('Erreur : ' + (err.error?.message || 'Erreur de connexion'), 'error');
        }
      });
  }
}