import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: Socket | null = null;
  private socketUrl = 'https://pedago.univ-avignon.fr:3170';
  
  constructor() {
    this.connect();
  }

  connect(): void {
    console.log('🔌 Initialisation WebSocket Service...');
    
    try {
      this.socket = io(this.socketUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        secure: true,
        rejectUnauthorized: false,
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connecté');
      });

      this.socket.on('disconnect', () => {
        console.log('❌ WebSocket déconnecté');
      });

      this.socket.on('error', (error: any) => {
        console.log('💥 Erreur de connexion WebSocket:', error);
      });

      this.socket.on('connect_error', (error: any) => {
        console.log('💥 Erreur de connexion WebSocket:', error);
      });

    } catch (error) {
      console.log('💥 Erreur WebSocket:', error);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      console.log('👋 WebSocket déconnecté manuellement');
    }
  }

  // ✅ Écouter les événements - retourne un Observable
  listen(event: string): Observable<any> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on(event, (data: any) => {
          console.log(`📩 Événement reçu: ${event}`, data);
          observer.next(data);
        });
      }
    });
  }

  // Émettre les événements
  emit(event: string, data: any): void {
    if (this.socket) {
      console.log(`📤 Événement émis: ${event}`, data);
      this.socket.emit(event, data);
    }
  }

  notifyUserConnected(userData: any): void {
    this.emit('userConnected', userData);
  }

  notifyNewComment(commentData: any): void {
    this.emit('newComment', commentData);
  }

  notifyPostLiked(likeData: any): void {
    this.emit('postLiked', likeData);
  }
}