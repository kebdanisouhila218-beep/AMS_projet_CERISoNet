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


@Component({
  selector: 'app-wall',
  standalone: true,
  imports: [CommonModule, FormsModule, Notification],
  templateUrl: './wall.html',
  styleUrl: './wall.css'
})
export class Wall implements OnInit, OnDestroy {

  posts: any[] = [];
  page: number = 1;
  totalPosts: number = 0;
  showForm: boolean = false;
  newBody: string = '';
  newImageTitle: string = '';
  newHashtags: string = '';
  selectedFile: File | null = null;

  debugInfo: any = {
    sessionStatus: 'Chargement...',
    userId: 'Inconnu',
    userEmail: 'Inconnu',
    lastLogin: 'Inconnu'
  };
  private checkSessionInterval: any;
  private socketSubscriptions: Subscription[] = [];
  onlineUsers: any[] = [];

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
    }, 30000); // 30 secondes
}

ngOnDestroy(): void {
    this.disconnectWebSocket();
    if (this.checkSessionInterval) {
        clearInterval(this.checkSessionInterval);
    }
}

checkSession(): void {
    this.http.get('https://pedago.univ-avignon.fr:3170/test-session', { withCredentials: true })
      .subscribe({
        next: (data: any) => {
          // Si pas connecté → rediriger
          if (!data.isConnected) {
            console.log(' Session expirée !');
            localStorage.removeItem('derniereConnexion');
            this.router.navigate(['/login']);
          }
        },
        error: () => {
          // Erreur serveur → rediriger par sécurité
          localStorage.removeItem('derniereConnexion');
          this.router.navigate(['/login']);
        }
      });
}
initWebSocket(): void {
    // ✅ Attendre que le socket soit connecté PUIS envoyer userConnected
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

    this.socketSubscriptions.push(
      this.websocketService.listen('userStatusUpdate').subscribe(data => {
        this.updateUserStatus(data);
      })
    );

    this.socketSubscriptions.push(
      this.websocketService.listen('commentAdded').subscribe(data => {
        this.handleNewComment(data);
      })
    );

    this.socketSubscriptions.push(
      this.websocketService.listen('onlineUsersList').subscribe(users => {
        this.onlineUsers = users;
        this.cdr.detectChanges(); // ✅ Force le refresh
      })
    );

    this.socketSubscriptions.push(
      this.websocketService.listen('postLikeUpdate').subscribe(data => {
        this.handleLikeUpdate(data);
      })
    );
}

  disconnectWebSocket(): void {
    this.socketSubscriptions.forEach(sub => sub.unsubscribe());
    this.socketSubscriptions = [];
    this.websocketService.disconnect();
  }

  updateUserStatus(data: any): void {
    const userIndex = this.onlineUsers.findIndex(u => u.userId === data.userId);
    if (userIndex !== -1) {
      this.onlineUsers[userIndex] = data;
    }
  }

  handleNewComment(commentData: any): void {
    this.authService.showNotification(
      `${commentData.authorPseudo} a commenté : "${commentData.comment.text}"`,
      'success'
    );
    this.loadPosts();
  }

handleLikeUpdate(likeData: any): void {
    const post = this.posts.find(p => p._id === likeData.postId);
    if (post) {
      post.userHasLiked = likeData.liked;
      post.totalLikes = likeData.totalLikes;
      this.cdr.detectChanges(); 
    }

    if (likeData.userId !== this.debugInfo.userId) {
      const action = likeData.liked ? 'liké' : 'n\'a plus liké';
      this.authService.showNotification(
        `${likeData.userPseudo} a ${action} ce post`,
        'info'
      );
    }
}

toggleLike(post: any): void {
    this.postService.toggleLike(post._id)
      .subscribe({
        next: (data: any) => {
          if (data.success) {
            post.userHasLiked = data.liked;
            post.totalLikes = data.totalLikes;
            this.cdr.detectChanges();
            
            const userPseudo = localStorage.getItem('userPseudo') || 'Utilisateur';
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
        error: (err) => {
          this.authService.showNotification('Erreur de connexion', 'error');
        }
      });
  }

  onLogout() {
    localStorage.removeItem('derniereConnexion');
    this.http.get<any>('https://pedago.univ-avignon.fr:3170/logout', { withCredentials: true }).subscribe({  // ✅ withCredentials ajouté
      next: () => { this.router.navigate(['/login']); },
      error: () => { this.router.navigate(['/login']); }
    });
  }

  loadHashtags(): void {
    this.postService.getHashtags().subscribe((data: any) => {
      if (data.success) this.availableHashtags = data.hashtags;
    });
  }

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

  onSortChange(): void {
    this.page = 1;
    this.loadPosts();
  }

  onFilterChange(): void {
    this.page = 1;
    this.loadPosts();
  }

  resetFilters(): void {
    this.sortOption = 'recent';
    this.filterHashtag = '';
    this.filterAuthor = '';
    this.page = 1;
    this.loadPosts();
  }

  get totalPages(): number {
    return Math.ceil(this.totalPosts / 10);
  }

  suivant(): void {
    this.page++;
    this.loadPosts();
  }

  precedent(): void {
    if (this.page > 1) {
      this.page--;
      this.loadPosts();
    }
  }

  onImageSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

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

  loadDebugInfo(): void {
    const derniereConnexion = localStorage.getItem('derniereConnexion');
    this.debugInfo.lastLogin = derniereConnexion || 'Non trouvée';
    this.testConnection();
  }

getUserPseudo(userId: number): string {
if (!userId) return 'Anonyme'; 
  const userMap: { [key: number]: string } = {
      1: 'Fourmi',
      2: 'Chien gris',
      3: 'Chat noir',
      4: 'Dauphin blanc',
      5: 'Requin noir',
      6: 'Écureuil blanc',
      7: 'Sardine grise',
      8: 'Poisson chat blanc',
      9: 'Écureuil blanc',
      10: 'Lapin rose',
      11: 'Panda géant',
      12: 'Tigre blanc',
      13: 'Lion doré',
      14: 'Aigle royal',
      15: 'Singe bleu',
      16: 'Zèbre rayé',
      17: 'Girafe jaune',
      18: 'Hippopotame rose',
      19: 'Crocodile vert',
      20: 'Flamant rose'
    };

    if (userMap[userId]) {
      return userMap[userId];
    }

    const animalTypes = ['Fourmi', 'Chien', 'Chat', 'Dauphin', 'Requin', 'Écureuil', 'Sardine', 'Poisson', 'Lapin', 'Panda', 'Tigre', 'Lion', 'Aigle', 'Singe', 'Zèbre', 'Girafe', 'Hippopotame', 'Crocodile', 'Flamant'];
    const animalIndex = (userId - 1) % animalTypes.length;

    return animalTypes[animalIndex] || `Utilisateur ${userId}`;
  }

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
        error: (err) => {
          this.debugInfo.sessionStatus = 'Erreur de connexion';
          this.debugInfo.userId = 'Erreur';
          this.debugInfo.userEmail = 'Erreur';
        }
      });
}

  addComment(post: any): void {
    if (!post.commentText || !post.commentText.trim()) {
      return;
    }

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
              authorPseudo: this.getUserPseudo(data.comment.commentedBy)
            });
          } else {
            const errorMessage = data.message || 'Erreur inconnue';
            this.authService.showNotification('Erreur : ' + errorMessage, 'error');
          }
        },
        error: (err) => {
          console.log('Erreur frontend:', err);
          const errorMessage = err.error?.message || err.message || 'Erreur de connexion';
          this.authService.showNotification('Erreur : ' + errorMessage, 'error');
        }
      });
  }
}