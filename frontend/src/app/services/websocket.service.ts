import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: Socket | null = null;
  private socketUrl = 'https://pedago.univ-avignon.fr:3170';

  // BehaviorSubject garde la dernière valeur même si Wall s'abonne après
  onlineUsers$ = new BehaviorSubject<any[]>([]);
  newComment$ = new Subject<any>();
  likeUpdate$ = new Subject<any>();
  userStatus$ = new Subject<any>();

  constructor(private http: HttpClient) {
    this.connect();
  }

  connect(): void {
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
      this.http.get('https://pedago.univ-avignon.fr:3170/test-session', { withCredentials: true })
        .subscribe((data: any) => {
          if (data.isConnected && data.userId) {
            this.emit('userConnected', {
              userId: data.userId,
              pseudo: data.userPseudo || 'Utilisateur'
            });
          }
        });
    });

    this.socket.on('onlineUsersList', (users: any[]) => {
      this.onlineUsers$.next(users);
    });

    this.socket.on('commentAdded', (data: any) => {
      this.newComment$.next(data);
    });

    this.socket.on('postLikeUpdate', (data: any) => {
      this.likeUpdate$.next(data);
    });

    this.socket.on('userStatusUpdate', (data: any) => {
      this.userStatus$.next(data);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  listen(event: string): Observable<any> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on(event, (data: any) => observer.next(data));
      }
    });
  }

  emit(event: string, data: any): void {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  notifyNewComment(commentData: any): void {
    this.emit('newComment', commentData);
  }

  notifyPostLiked(likeData: any): void {
    this.emit('postLiked', likeData);
  }
}