import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../services/post';
import { Notification } from '../notification/notification';
import { Auth } from '../../services/auth';
import { WebsocketService } from '../../services/websocket.service';
import { Subscription } from 'rxjs';
import { OnlineUsersComponent } from '../online-users/online-users';
import { FilterBarComponent } from '../filter-bar/filter-bar';
import { PostCardComponent } from '../post-card/post-card';

@Component({
  selector: 'app-wall',
  standalone: true,
  imports: [CommonModule, FormsModule, Notification, OnlineUsersComponent, FilterBarComponent, PostCardComponent],
  templateUrl: './wall.html',
  styleUrl: './wall.css'
})
export class Wall implements OnInit, OnDestroy {

  // Liste des posts affichés
  posts: any[] = [];
  // Page courante pour la pagination
  page: number = 1;
  // Nombre total de posts
  totalPosts: number = 0;
  // Afficher ou cacher le formulaire de nouveau post
  showForm: boolean = false;
  // Champs du formulaire de nouveau post
  newBody: string = '';
  newImageTitle: string = '';
  newHashtags: string = '';
  selectedFile: File | null = null;

  // Informations de session de l'utilisateur connecté
  debugInfo: any = {
    sessionStatus: 'Chargement...',
    userId: 'Inconnu',
    userEmail: 'Inconnu',
    lastLogin: 'Inconnu'
  };

  // Intervalle de vérification de session toutes les 30 secondes
  private checkSessionInterval: any;
  // Souscriptions WebSocket à désabonner à la destruction
  private socketSubscriptions: Subscription[] = [];
  // Liste des utilisateurs connectés en temps réel
  onlineUsers: any[] = [];

  // Options de tri et filtres
  sortOption: string = 'recent';
  filterHashtag: string = '';
  filterAuthor: string = '';
  availableHashtags: string[] = [];

  constructor(
    private router: Router,
    private http: HttpClient,
    private postService: PostService,
    private cdr: ChangeDetectorRef,
    private authService: Auth,
    private websocketService: WebsocketService
  ) {}

  // Initialisation : vérifie la session, charge les posts et démarre le WebSocket
  ngOnInit(): void {
    const derniereConnexion = localStorage.getItem('derniereConnexion');
    if (!derniereConnexion) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadDebugInfo();
    this.loadHashtags();
    this.loadPosts();
    this.initWebSocket();
    this.checkSessionInterval = setInterval(() => {
      this.checkSession();
    }, 30000);
  }

  // Nettoyage : déconnecte le WebSocket et arrête l'intervalle
  ngOnDestroy(): void {
    this.disconnectWebSocket();
    if (this.checkSessionInterval) {
      clearInterval(this.checkSessionInterval);
    }
  }

  // Vérifie que la session est encore active, sinon redirige vers login
  checkSession(): void {
    this.http.get('https://pedago.univ-avignon.fr:3170/test-session', { withCredentials: true })
      .subscribe({
        next: (data: any) => {
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

  // Initialise les écouteurs WebSocket pour les événements temps réel
  initWebSocket(): void {
    // Quand le socket est connecté, on s'identifie auprès du serveur
    this.websocketService.listen('connect').subscribe(() => {
      this.http.get('https://pedago.univ-avignon.fr:3170/test-session', { withCredentials: true })
        .subscribe((data: any) => {
          if (data.isConnected && data.userId) {
            this.websocketService.emit('userConnected', {
              userId: data.userId,
              pseudo: data.userPseudo || 'Utilisateur'
            });
          }
        });
    });

    // Mise à jour du statut d'un utilisateur (connecté/déconnecté)
    this.socketSubscriptions.push(
      this.websocketService.listen('userStatusUpdate').subscribe(data => {
        this.updateUserStatus(data);
      })
    );

    // Nouveau commentaire reçu depuis un autre utilisateur
    this.socketSubscriptions.push(
      this.websocketService.listen('commentAdded').subscribe(data => {
        this.handleNewComment(data);
      })
    );

    // Liste mise à jour des utilisateurs connectés
    this.socketSubscriptions.push(
      this.websocketService.listen('onlineUsersList').subscribe(users => {
        this.onlineUsers = users;
        this.cdr.detectChanges();
      })
    );

    // Mise à jour des likes en temps réel depuis un autre utilisateur
    this.socketSubscriptions.push(
      this.websocketService.listen('postLikeUpdate').subscribe(data => {
        this.handleLikeUpdate(data);
      })
    );
  }

  // Déconnecte proprement tous les abonnements WebSocket
  disconnectWebSocket(): void {
    this.socketSubscriptions.forEach(sub => sub.unsubscribe());
    this.socketSubscriptions = [];
    this.websocketService.disconnect();
  }

  // Met à jour le statut d'un utilisateur dans la liste des connectés
  updateUserStatus(data: any): void {
    const userIndex = this.onlineUsers.findIndex(u => u.userId === data.userId);
    if (userIndex !== -1) {
      this.onlineUsers[userIndex] = data;
    }
  }

  // Recharge les posts et notifie quand un nouveau commentaire arrive
  handleNewComment(commentData: any): void {
    this.authService.showNotification(
      `${commentData.authorPseudo} a commenté : "${commentData.comment.text}"`,
      'success'
    );
    this.loadPosts();
  }

  // Met à jour le compteur de likes en temps réel sans recharger les posts
  handleLikeUpdate(likeData: any): void {
    const index = this.posts.findIndex(p => p._id === likeData.postId);
    if (index !== -1) {
      // Crée un nouvel objet pour forcer la détection de changement Angular
      this.posts[index] = {
        ...this.posts[index],
        userHasLiked: likeData.liked,
        totalLikes: likeData.totalLikes
      };
      this.cdr.detectChanges();
    }
    // N'affiche la notification que si c'est un AUTRE utilisateur
    if (String(likeData.userId) !== String(this.debugInfo.userId)) {
      const action = likeData.liked ? 'liké' : 'n\'a plus liké';
      this.authService.showNotification(
        `${likeData.userPseudo} a ${action} ce post`,
        'info'
      );
    }
  }

  // Envoie ou retire un like sur un post via l'API puis notifie via WebSocket
  toggleLike(post: any): void {
    this.postService.toggleLike(post._id)
      .subscribe({
        next: (data: any) => {
          if (data.success) {
            // Crée un nouvel objet pour forcer la détection de changement Angular
            const index = this.posts.findIndex(p => p._id === post._id);
            if (index !== -1) {
              this.posts[index] = {
                ...this.posts[index],
                userHasLiked: data.liked,
                totalLikes: data.totalLikes
              };
            }
            this.cdr.detectChanges();
            const userPseudo = localStorage.getItem('userPseudo') || 'Utilisateur';
            // Notifie tous les autres utilisateurs via WebSocket
            this.websocketService.notifyPostLiked({
              postId: post._id,
              userId: this.debugInfo.userId,
              userPseudo: userPseudo,
              liked: data.liked,
              totalLikes: data.totalLikes
            });
            const action = data.liked ? 'liké' : 'n\'a plus liké';
            this.authService.showNotification(`Tu as ${action} ce post`, 'success');
          } else {
            this.authService.showNotification('Erreur : ' + data.message, 'error');
          }
        },
        error: () => {
          this.authService.showNotification('Erreur de connexion', 'error');
        }
      });
  }

  // Déconnecte l'utilisateur et redirige vers la page login
  onLogout() {
    localStorage.removeItem('derniereConnexion');
    this.http.get<any>('https://pedago.univ-avignon.fr:3170/logout', { withCredentials: true }).subscribe({
      next: () => { this.router.navigate(['/login']); },
      error: () => { this.router.navigate(['/login']); }
    });
  }

  // Charge la liste des hashtags disponibles pour le filtre
  loadHashtags(): void {
    this.postService.getHashtags().subscribe((data: any) => {
      if (data.success) this.availableHashtags = data.hashtags;
    });
  }

  // Charge les posts selon la page, le tri et les filtres actifs
  loadPosts(): void {
    this.postService.getPosts(this.page, this.sortOption, this.filterHashtag, this.filterAuthor)
      .subscribe((data: any) => {
        if (data.success) {
          this.posts = data.posts;
          this.totalPosts = data.total || 0;
          this.cdr.detectChanges();
        }
      });
  }

  // Remet à la page 1 et recharge quand le tri change
  onSortChange(): void {
    this.page = 1;
    this.loadPosts();
  }

  // Remet à la page 1 et recharge quand le filtre hashtag change
  onFilterChange(): void {
    this.page = 1;
    this.loadPosts();
  }

  // Reçoit le nouveau tri depuis filter-bar et recharge
  onSortOptionChange(value: string): void {
    this.sortOption = value;
    this.onSortChange();
  }

  // Reçoit le nouveau hashtag depuis filter-bar et recharge
  onHashtagChange(value: string): void {
    this.filterHashtag = value;
    this.onFilterChange();
  }

  // Remet tous les filtres à zéro
  resetFilters(): void {
    this.sortOption = 'recent';
    this.filterHashtag = '';
    this.filterAuthor = '';
    this.page = 1;
    this.loadPosts();
  }

  // Calcule le nombre total de pages pour la pagination
  get totalPages(): number {
    return Math.ceil(this.totalPosts / 10);
  }

  // Passe à la page suivante
  suivant(): void {
    this.page++;
    this.loadPosts();
  }

  // Revient à la page précédente
  precedent(): void {
    if (this.page > 1) {
      this.page--;
      this.loadPosts();
    }
  }

  // Récupère le fichier image sélectionné
  onImageSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  // Prépare les données du post et uploade l'image si présente
  publierPost(): void {
    if (!this.newBody.trim()) return;
    const hashtags = this.newHashtags
      .split(' ')
      .map(h => h.trim())
      .filter(h => h.startsWith('#'));
    if (this.selectedFile) {
      this.postService.uploadImage(this.selectedFile).subscribe((uploadData: any) => {
        if (uploadData.success) {
          this.envoyerPost(hashtags, uploadData.url);
        }
      });
    } else {
      this.envoyerPost(hashtags, '');
    }
  }

  // Envoie le post au serveur via le service
  envoyerPost(hashtags: string[], imageUrl: string): void {
    const postData: any = { body: this.newBody, hashtags: hashtags };
    if (imageUrl) {
      postData.image = { url: imageUrl, title: this.newImageTitle };
    }
    this.postService.createPost(postData).subscribe((data: any) => {
      if (data.success) {
        this.newBody = '';
        this.newImageTitle = '';
        this.newHashtags = '';
        this.selectedFile = null;
        this.showForm = false;
        this.page = 1;
        this.loadPosts();
        this.authService.showNotification('Post publié avec succès', 'success');
      } else {
        this.authService.showNotification('Erreur : ' + data.message, 'error');
      }
    });
  }

  // Charge les infos de session et la dernière connexion depuis le localStorage
  loadDebugInfo(): void {
    const derniereConnexion = localStorage.getItem('derniereConnexion');
    this.debugInfo.lastLogin = derniereConnexion || 'Non trouvée';
    this.testConnection();
  }

  // Vérifie la session et identifie l'utilisateur via WebSocket
  testConnection(): void {
    this.http.get('https://pedago.univ-avignon.fr:3170/test-session', { withCredentials: true })
      .subscribe({
        next: (data: any) => {
          this.debugInfo.sessionStatus = data.isConnected ? 'Connecté' : 'Non connecté';
          this.debugInfo.userId = data.userId || 'Inconnu';
          this.debugInfo.userEmail = localStorage.getItem('userEmail') || 'Inconnu';
          if (data.isConnected && data.userId) {
            this.websocketService.emit('userConnected', {
              userId: data.userId,
              pseudo: data.userPseudo || 'Utilisateur'
            });
          }
        },
        error: () => {
          this.debugInfo.sessionStatus = 'Erreur de connexion';
          this.debugInfo.userId = 'Erreur';
          this.debugInfo.userEmail = 'Erreur';
        }
      });
  }

  // Envoie un commentaire au serveur et notifie via WebSocket
  addComment(post: any): void {
    if (!post.commentText || !post.commentText.trim()) return;
    this.postService.addComment(post._id, post.commentText.trim())
      .subscribe({
        next: (data: any) => {
          if (data.success) {
            post.commentText = '';
            this.loadPosts();
            this.authService.showNotification('Commentaire ajouté', 'success');
            this.websocketService.notifyNewComment({
              postId: post._id,
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