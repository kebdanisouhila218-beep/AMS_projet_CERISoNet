import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
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

  posts: any[] = [];
  page = 1;
  totalPosts = 0;
  showForm = false;
  newBody = '';
  newImageTitle = '';
  newHashtags = '';
  selectedFile: File | null = null;

  currentUserId: string = 'Inconnu';
  onlineUsers: any[] = [];
  availableHashtags: string[] = [];
  availableAuthors: { id: number; name: string }[] = [];
  sortOption = 'recent';
  filterHashtag = '';
  filterAuthor = '';

  private checkSessionInterval: any;
  private subs: Subscription[] = [];

  constructor(
    private postService: PostService,
    private cdr: ChangeDetectorRef,
    private authService: Auth,
    private websocketService: WebsocketService
  ) {}

  ngOnInit(): void {
    // EN PREMIER : abonnements WebSocket avant tout appel réseau
    this.initWebSocketSubscriptions();

    // ENSUITE : abonnement userId$ avant loadSession
    this.subs.push(
      this.authService.userId$.subscribe(id => {
        this.currentUserId = id;
        this.cdr.detectChanges();
      })
    );

    // ENSUITE : appels réseau
    this.authService.loadSession(this.websocketService);
    this.loadHashtags();
    this.loadAuthors();
    this.loadPosts();

    this.checkSessionInterval = setInterval(
      () => this.authService.checkSession(), 30000
    );
  }

  ngOnDestroy(): void {
    // On désinscrit les subscriptions Angular
    this.subs.forEach(s => s.unsubscribe());

    // ← ON NE DÉCONNECTE PAS le WebSocket ici !
    // Le WebsocketService est providedIn: 'root' (singleton global).
    // Appeler disconnect() ici couperait le socket pour toute l'app
    // et provoquerait la boucle connect/disconnect visible dans les logs.

    if (this.checkSessionInterval) clearInterval(this.checkSessionInterval);
  }

  initWebSocketSubscriptions(): void {
    this.subs.push(
      this.websocketService.onlineUsers$.subscribe(users => {
        this.onlineUsers = [...users]; // spread pour forcer une nouvelle référence
        this.cdr.detectChanges();
      })
    );
    this.subs.push(
      this.websocketService.newComment$.subscribe(commentData => {
        this.authService.showNotification(
          `${commentData.authorPseudo} a commenté : "${commentData.comment.text}"`, 'success'
        );
        this.loadPosts();
      })
    );
    this.subs.push(
      this.websocketService.likeUpdate$.subscribe(likeData => {
        const index = this.posts.findIndex(p => p._id === likeData.postId);
        if (index !== -1) {
          this.posts[index] = {
            ...this.posts[index],
            userHasLiked: likeData.liked,
            totalLikes: likeData.totalLikes
          };
          this.cdr.detectChanges();
        }
        if (String(likeData.userId) !== String(this.currentUserId)) {
          const action = likeData.liked ? 'liké' : 'n\'a plus liké';
          this.authService.showNotification(`${likeData.userPseudo} a ${action} ce post`, 'info');
        }
      })
    );
  }

  onLogout(): void {
    // On déconnecte le socket UNIQUEMENT lors du logout explicite
    this.websocketService.disconnect();
    this.authService.logout();
  }

  loadHashtags(): void {
    this.postService.getHashtags().subscribe((data: any) => {
      if (data.success) this.availableHashtags = data.hashtags;
    });
  }

  loadAuthors(): void {
    this.postService.getAuthors().subscribe((data: any) => {
      if (data.success) {
        this.availableAuthors = data.authors;
        this.cdr.detectChanges();
      }
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

  onFiltersChanged(filters: { sort: string; hashtag: string; author: string }): void {
    this.sortOption = filters.sort;
    this.filterHashtag = filters.hashtag;
    this.filterAuthor = filters.author;
    this.page = 1;
    this.loadPosts();
  }

  get totalPages(): number { return Math.ceil(this.totalPosts / 10); }
  suivant(): void { this.page++; this.loadPosts(); }
  precedent(): void { if (this.page > 1) { this.page--; this.loadPosts(); } }

  onImageSelected(event: any): void {
    const file = event.target.files[0];
    if (file) this.selectedFile = file;
  }

  publierPost(): void {
    if (!this.newBody.trim()) return;
    const hashtags = this.newHashtags.split(' ').map(h => h.trim()).filter(h => h.startsWith('#'));
    if (this.selectedFile) {
      this.postService.uploadImage(this.selectedFile).subscribe((uploadData: any) => {
        if (uploadData.success) this.envoyerPost(hashtags, uploadData.url);
      });
    } else {
      this.envoyerPost(hashtags, '');
    }
  }

  envoyerPost(hashtags: string[], imageUrl: string): void {
    const postData: any = { body: this.newBody, hashtags };
    if (imageUrl) postData.image = { url: imageUrl, title: this.newImageTitle };
    this.postService.createPost(postData).subscribe((data: any) => {
      if (data.success) {
        this.newBody = ''; this.newImageTitle = ''; this.newHashtags = '';
        this.selectedFile = null; this.showForm = false; this.page = 1;
        this.loadPosts();
        this.authService.showNotification('Post publié avec succès', 'success');
      } else {
        this.authService.showNotification('Erreur : ' + data.message, 'error');
      }
    });
  }
}