import { Component, Input, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
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
  @Input() post: any;
  @Input() currentUserId: any;

  constructor(
    public postService: PostService,
    private authService: Auth,
    private websocketService: WebsocketService,
    private cdr: ChangeDetectorRef
  ) {}

  onLike(): void {
    this.postService.toggleLike(this.post._id).subscribe((data: any) => {
      if (data.success) {
        // Réassignation complète pour forcer la détection Angular
        this.post = {
          ...this.post,
          userHasLiked: data.liked,
          totalLikes: data.totalLikes
        };
        this.cdr.detectChanges();
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
@Output() postShared = new EventEmitter<void>();

onShare(): void {
  const body = this.post.shareText?.trim() || 'Je partage ce post.';
  this.postService.sharePost(this.post._id, body).subscribe((data: any) => {
    if (data.success) {
      this.post = { ...this.post, showShareForm: false, shareText: '' };
      this.cdr.detectChanges();
      this.postShared.emit(); // 👈 signal au parent de recharger
      this.authService.showNotification('Post partagé avec succès', 'success');
    } else {
      this.authService.showNotification('Erreur : ' + data.message, 'error');
    }
  });
}
  onComment(): void {
    if (!this.post.commentText?.trim()) return;
    this.postService.addComment(this.post._id, this.post.commentText.trim())
      .subscribe({
        next: (data: any) => {
          if (data.success) {
            this.post = {
              ...this.post,
              commentText: '',
              comments: [...(this.post.comments || []), data.comment]
            };
            this.cdr.detectChanges();
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