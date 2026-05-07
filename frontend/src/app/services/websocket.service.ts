import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

/**
 * Service WebsocketService
 * Gère la connexion WebSocket en temps réel via Socket.io
 * Singleton global (providedIn: 'root') → une seule instance pour toute l'app
 */
@Injectable({
  providedIn: 'root'
})
export class WebsocketService {

  /** Instance du socket Socket.io */
  private socket: Socket | null = null;

  /** URL du serveur WebSocket */
  private socketUrl = 'https://pedago.univ-avignon.fr:3170';

  // ============================================================
  // Observables partagés avec les composants qui s'abonnent
  // ============================================================

  /** BehaviorSubject : garde la dernière liste connue des utilisateurs connectés */
  onlineUsers$ = new BehaviorSubject<any[]>([]);

  /** Subject : émet à chaque nouveau commentaire reçu */
  newComment$ = new Subject<any>();

  /** Subject : émet à chaque mise à jour de like reçue */
  likeUpdate$ = new Subject<any>();

  /** Subject : émet à chaque changement de statut d'un utilisateur */
  userStatus$ = new Subject<any>();

  constructor(private http: HttpClient) {
    // Crée une connexion WebSocket dès l'instanciation du service
    this.connect();
  }

  /**
   * Identifie l'utilisateur connecté auprès du serveur WebSocket
   * Appelé depuis auth.ts après confirmation de session
   * Coupe l'ancien socket et en crée un nouveau propre
   * @param userId - ID de l'utilisateur connecté
   * @param pseudo - Pseudo de l'utilisateur connecté
   */
  identify(userId: any, pseudo: string): void {
    console.log('identify() appelé pour:', pseudo);

    // Déconnecte proprement l'ancien socket s'il existe
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Crée un nouveau socket propre pour cet utilisateur
    this.connect();

    // Attend la connexion puis envoie l'identification au serveur
    this.socket!.once('connect', () => {
      console.log('Socket connecté, identification:', pseudo);
      this.socket!.emit('userConnected', { userId, pseudo });
    });
  }

  /**
   * Crée la connexion Socket.io et enregistre tous les écouteurs d'événements
   * Options : reconnexion automatique, WebSocket puis polling en fallback
   */
  connect(): void {
    this.socket = io(this.socketUrl, {
      reconnection: true,           // reconnexion automatique si coupure
      reconnectionDelay: 1000,      // attend 1s avant de retenter
      reconnectionDelayMax: 5000,   // max 5s entre les tentatives
      reconnectionAttempts: 5,      // max 5 tentatives
      secure: true,
      rejectUnauthorized: false,
      transports: ['websocket', 'polling'] // WebSocket en priorité, polling en fallback
    });

    // Confirmation de connexion
    this.socket.on('connect', () => {
      console.log('WebSocket connecté:', this.socket?.id);
    });

    // Reçoit la liste mise à jour des utilisateurs connectés
    this.socket.on('onlineUsersList', (users: any[]) => {
      this.onlineUsers$.next(users);
    });

    // Reçoit un nouveau commentaire → notifie les abonnés
    this.socket.on('commentAdded', (data: any) => {
      this.newComment$.next(data);
    });

    // Reçoit une mise à jour de like → notifie les abonnés
    this.socket.on('postLikeUpdate', (data: any) => {
      this.likeUpdate$.next(data);
    });

    // Reçoit un changement de statut utilisateur (connecté/déconnecté)
    this.socket.on('userStatusUpdate', (data: any) => {
      this.userStatus$.next(data);
    });
  }

  /**
   * Déconnecte le socket proprement
   * Appelé UNIQUEMENT lors du logout explicite de l'utilisateur
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners(); // supprime tous les écouteurs
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Crée un Observable qui écoute un événement Socket.io
   * @param event - Nom de l'événement à écouter
   * @returns Observable qui émet à chaque réception de l'événement
   */
  listen(event: string): Observable<any> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on(event, (data: any) => observer.next(data));
      }
    });
  }

  /**
   * Envoie un événement au serveur via Socket.io
   * @param event - Nom de l'événement
   * @param data - Données à envoyer
   */
  emit(event: string, data: any): void {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Notifie le serveur qu'un nouveau commentaire a été ajouté
   * Le serveur le broadcastera aux autres utilisateurs connectés
   * @param commentData - { postId, comment, authorPseudo }
   */
  notifyNewComment(commentData: any): void {
    this.emit('newComment', commentData);
  }

  /**
   * Notifie le serveur qu'un like a été ajouté ou retiré
   * Le serveur le broadcastera aux autres utilisateurs connectés
   * @param likeData - { postId, userId, userPseudo, liked, totalLikes }
   */
  notifyPostLiked(likeData: any): void {
    this.emit('postLiked', likeData);
  }
}