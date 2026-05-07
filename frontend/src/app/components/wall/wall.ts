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

/**
 * Composant Wall
 * Page principale de l'application après connexion
 * Affiche les posts, gère les filtres, la pagination et le formulaire de création
 */
@Component({
  selector: 'app-wall',
  standalone: true,
  imports: [CommonModule, FormsModule, Notification, OnlineUsersComponent, FilterBarComponent, PostCardComponent],
  templateUrl: './wall.html',
  styleUrl: './wall.css'
})
export class Wall implements OnInit, OnDestroy {

  /** Liste des posts affichés */
  posts: any[] = [];

  /** Page courante pour la pagination */
  page = 1;

  /** Nombre total de posts (pour calculer les pages) */
  totalPosts = 0;

  /** Affiche ou masque le formulaire de création de post */
  showForm = false;

  /** Champs du formulaire de nouveau post */
  newBody = '';
  newImageTitle = '';
  newHashtags = '';
  selectedFile: File | null = null;

  /** ID de l'utilisateur connecté, reçu depuis Auth Service */
  currentUserId: string = 'Inconnu';

  /** Liste des utilisateurs connectés en temps réel (WebSocket) */
  onlineUsers: any[] = [];

  /** Listes pour les filtres */
  availableHashtags: string[] = [];
  availableAuthors: { id: number; name: string }[] = [];

  /** Options de filtrage actives */
  sortOption = 'recent';
  filterHashtag = '';
  filterAuthor = '';

  /** Interval pour vérifier la session toutes les 30 secondes */
  private checkSessionInterval: any;

  /** Tableau des subscriptions pour les désinscrire proprement dans ngOnDestroy */
  private subs: Subscription[] = [];

  constructor(
    private postService: PostService,
    private cdr: ChangeDetectorRef,
    private authService: Auth,
    private websocketService: WebsocketService
  ) {}

  /**
   * Initialisation du composant
   * Ordre important : WebSocket → userId$ → appels réseau
   */
  ngOnInit(): void {
    // 1. Abonnements WebSocket EN PREMIER pour ne rater aucun événement
    this.initWebSocketSubscriptions();

    // 2. Abonnement à userId$ AVANT loadSession pour recevoir l'ID dès qu'il arrive
    this.subs.push(
      this.authService.userId$.subscribe(id => {
        this.currentUserId = id;
        this.cdr.detectChanges();
      })
    );

    // 3. Appels réseau : session, hashtags, auteurs, posts
    this.authService.loadSession(this.websocketService);
    this.loadHashtags();
    this.loadAuthors();
    this.loadPosts();

    // 4. Vérifie la session toutes les 30 secondes
    this.checkSessionInterval = setInterval(
      () => this.authService.checkSession(), 30000
    );
  }

  /**
   * Nettoyage lors de la destruction du composant
   * Désinscrit les subscriptions Angular mais NE déconnecte PAS le WebSocket
   * car le WebsocketService est singleton (providedIn: 'root')
   */
  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());

    // ← ON NE DÉCONNECTE PAS le WebSocket ici !
    // Appeler disconnect() provoquerait une boucle connect/disconnect
    // car le service est partagé dans toute l'application

    if (this.checkSessionInterval) clearInterval(this.checkSessionInterval);
  }

  /**
   * Initialise les 3 abonnements WebSocket :
   * - Liste des utilisateurs connectés
   * - Nouveaux commentaires
   * - Mises à jour des likes
   */
  initWebSocketSubscriptions(): void {

    // Écoute la liste des utilisateurs connectés
    this.subs.push(
      this.websocketService.onlineUsers$.subscribe(users => {
        this.onlineUsers = [...users]; // spread pour forcer une nouvelle référence Angular
        this.cdr.detectChanges();
      })
    );

    // Écoute les nouveaux commentaires → notification + rechargement des posts
    this.subs.push(
      this.websocketService.newComment$.subscribe(commentData => {
        this.authService.showNotification(
          `${commentData.authorPseudo} a commenté : "${commentData.comment.text}"`, 'success'
        );
        this.loadPosts();
      })
    );

    // Écoute les mises à jour de likes → met à jour le post localement sans rechargement
    this.subs.push(
      this.websocketService.likeUpdate$.subscribe(likeData => {
        const index = this.posts.findIndex(p => p._id === likeData.postId);
        if (index !== -1) {
          // Réassignation pour forcer la détection Angular
          this.posts[index] = {
            ...this.posts[index],
            userHasLiked: likeData.liked,
            totalLikes: likeData.totalLikes
          };
          this.cdr.detectChanges();
        }
        // Notification uniquement si c'est un autre utilisateur qui a liké
        if (String(likeData.userId) !== String(this.currentUserId)) {
          const action = likeData.liked ? 'liké' : 'n\'a plus liké';
          this.authService.showNotification(`${likeData.userPseudo} a ${action} ce post`, 'info');
        }
      })
    );
  }

  /**
   * Déconnexion explicite de l'utilisateur
   * C'est le SEUL endroit où on déconnecte le WebSocket
   */
  onLogout(): void {
    this.websocketService.disconnect();
    this.authService.logout();
  }

  /** Charge les hashtags disponibles pour le filtre */
  loadHashtags(): void {
    this.postService.getHashtags().subscribe((data: any) => {
      if (data.success) this.availableHashtags = data.hashtags;
    });
  }

  /** Charge les auteurs disponibles pour le filtre */
  loadAuthors(): void {
    this.postService.getAuthors().subscribe((data: any) => {
      if (data.success) {
        this.availableAuthors = data.authors;
        this.cdr.detectChanges();
      }
    });
  }

  /** Charge les posts selon la page et les filtres actifs */
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

  /**
   * Reçoit les filtres depuis FilterBar et recharge les posts
   * @param filters - { sort, hashtag, author }
   */
  onFiltersChanged(filters: { sort: string; hashtag: string; author: string }): void {
    this.sortOption = filters.sort;
    this.filterHashtag = filters.hashtag;
    this.filterAuthor = filters.author;
    this.page = 1; // reset à la page 1 à chaque nouveau filtre
    this.loadPosts();
  }

  /** Calcule le nombre total de pages */
  get totalPages(): number { return Math.ceil(this.totalPosts / 10); }

  /** Passe à la page suivante */
  suivant(): void { this.page++; this.loadPosts(); }

  /** Revient à la page précédente */
  precedent(): void { if (this.page > 1) { this.page--; this.loadPosts(); } }

  /** Stocke le fichier image sélectionné */
  onImageSelected(event: any): void {
    const file = event.target.files[0];
    if (file) this.selectedFile = file;
  }

  /**
   * Lance la publication d'un post
   * Upload l'image d'abord si une image est sélectionnée
   */
  publierPost(): void {
    if (!this.newBody.trim()) return;

    // Extrait les hashtags du champ texte (mots commençant par #)
    const hashtags = this.newHashtags.split(' ').map(h => h.trim()).filter(h => h.startsWith('#'));

    if (this.selectedFile) {
      // Upload l'image puis envoie le post avec l'URL
      this.postService.uploadImage(this.selectedFile).subscribe((uploadData: any) => {
        if (uploadData.success) this.envoyerPost(hashtags, uploadData.url);
      });
    } else {
      // Envoie le post sans image
      this.envoyerPost(hashtags, '');
    }
  }

  /**
   * Envoie le post au serveur et recharge la liste
   * @param hashtags - Liste des hashtags extraits
   * @param imageUrl - URL de l'image uploadée (vide si pas d'image)
   */
  envoyerPost(hashtags: string[], imageUrl: string): void {
    const postData: any = { body: this.newBody, hashtags };
    if (imageUrl) postData.image = { url: imageUrl, title: this.newImageTitle };

    this.postService.createPost(postData).subscribe((data: any) => {
      if (data.success) {
        // Réinitialise le formulaire
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