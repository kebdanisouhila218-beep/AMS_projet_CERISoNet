import { Component, Input, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../services/post';
import { Auth } from '../../services/auth';
import { WebsocketService } from '../../services/websocket.service';

/**
 * Composant PostCard
 * Affiche un post avec ses actions : like, commentaire, partage
 */
@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css'
})
export class PostCardComponent {

  /** Post à afficher, reçu du composant parent (Wall) */
  @Input() post: any;

  /** ID de l'utilisateur connecté, reçu du composant parent */
  @Input() currentUserId: any;

  /** Événement émis vers le parent pour recharger les posts après un partage */
  @Output() postShared = new EventEmitter<void>();

  constructor(
    public postService: PostService,        // Service pour les requêtes posts (like, commentaire, partage)
    private authService: Auth,              // Service pour afficher les notifications
    private websocketService: WebsocketService, // Service WebSocket pour notifier en temps réel
    private cdr: ChangeDetectorRef          // Détection de changements Angular manuelle
  ) {}

  /**
   * Gère le like/unlike d'un post
   * Envoie la requête au serveur, met à jour le post localement
   * et notifie les autres utilisateurs via WebSocket
   */
  onLike(): void {
    this.postService.toggleLike(this.post._id).subscribe((data: any) => {
      if (data.success) {
        // Réassignation complète pour forcer la détection Angular
        this.post = {
          ...this.post,
          userHasLiked: data.liked,
          totalLikes: data.totalLikes
        };

        // Force Angular à mettre à jour la vue
        this.cdr.detectChanges();

        // Affiche une notification à l'utilisateur
        const action = data.liked ? 'liké' : 'n\'a plus liké';
        this.authService.showNotification(`Tu as ${action} ce post`, 'success');

        // Notifie les autres utilisateurs connectés via WebSocket
        this.websocketService.notifyPostLiked({
          postId: this.post._id,
          userId: this.currentUserId,
          userPseudo: localStorage.getItem('userPseudo') || 'Utilisateur',
          liked: data.liked,
          totalLikes: data.totalLikes
        });
      } else {
        // Affiche l'erreur retournée par le serveur
        this.authService.showNotification('Erreur : ' + data.message, 'error');
      }
    });
  }

  /**
   * Gère le partage d'un post
   * Crée un nouveau post avec référence au post original
   * et émet un événement pour recharger le Wall
   */
  onShare(): void {
    // Utilise le texte saisi ou un texte par défaut
    const body = this.post.shareText?.trim() || 'Je partage ce post.';

    this.postService.sharePost(this.post._id, body).subscribe((data: any) => {
      if (data.success) {
        // Ferme le formulaire de partage et réinitialise le texte
        this.post = { ...this.post, showShareForm: false, shareText: '' };
        this.cdr.detectChanges();

        // Signale au composant parent (Wall) de recharger la liste des posts
        this.postShared.emit();

        this.authService.showNotification('Post partagé avec succès', 'success');
      } else {
        this.authService.showNotification('Erreur : ' + data.message, 'error');
      }
    });
  }

  /**
   * Gère l'ajout d'un commentaire sur un post
   * Envoie le commentaire au serveur, l'ajoute localement
   * et notifie les autres utilisateurs via WebSocket
   */
  onComment(): void {
    // Vérifie que le champ commentaire n'est pas vide
    if (!this.post.commentText?.trim()) return;

    this.postService.addComment(this.post._id, this.post.commentText.trim())
      .subscribe({
        next: (data: any) => {
          if (data.success) {
            // Réinitialise le champ et ajoute le nouveau commentaire à la liste
            this.post = {
              ...this.post,
              commentText: '',
              comments: [...(this.post.comments || []), data.comment]
            };
            this.cdr.detectChanges();

            this.authService.showNotification('Commentaire ajouté', 'success');

            // Notifie les autres utilisateurs via WebSocket
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
          // Gère les erreurs réseau ou serveur
          this.authService.showNotification('Erreur : ' + (err.error?.message || 'Erreur de connexion'), 'error');
        }
      });
  }
}