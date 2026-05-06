import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PostService {
  private baseUrl = 'https://pedago.univ-avignon.fr:3170';
  private httpOptions = {
    withCredentials: true
  };

  constructor(private http: HttpClient) {}

  getPosts(page: number = 1, sort: string = 'recent', hashtag: string = '', author: string = ''): Observable<any> {
    let params = `page=${page}&sort=${sort}`;
    if (hashtag) params += `&hashtag=${encodeURIComponent(hashtag)}`;
    if (author)  params += `&author=${encodeURIComponent(author)}`; //  encodeURIComponent ajouté
    return this.http.get<any>(`${this.baseUrl}/posts?${params}`, this.httpOptions); //  baseUrl utilisé
  }

  getHashtags(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/posts/hashtags`, this.httpOptions); //  baseUrl utilisé
  }

  createPost(postData: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts/new`, postData, this.httpOptions);
  }

  uploadImage(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<any>(`${this.baseUrl}/upload`, formData, this.httpOptions);
  }

  addComment(postId: string, text: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts/${postId}/comment`, { text }, this.httpOptions);
  }

  toggleLike(postId: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts/${postId}/like`, {}, this.httpOptions);
  }

  sharePost(postId: string, body: string): Observable<any> {
  return this.http.post<any>(
    `${this.baseUrl}/posts/share`,
    { sharedPostId: postId, body },
    this.httpOptions
  );
}

  getUserPseudo(userId: number): string {
  if (!userId) return 'Anonyme';
  const userMap: { [key: number]: string } = {
    1: 'Fourmi', 2: 'Chien gris', 3: 'Chat noir', 4: 'Dauphin blanc',
    5: 'Requin noir', 6: 'Écureuil blanc', 7: 'Sardine grise',
    8: 'Poisson chat blanc', 9: 'Écureuil blanc', 10: 'Lapin rose',
    11: 'Panda géant', 12: 'Tigre blanc', 13: 'Lion doré',
    14: 'Aigle royal', 15: 'Singe bleu', 16: 'Zèbre rayé',
    17: 'Girafe jaune', 18: 'Hippopotame rose', 19: 'Crocodile vert',
    20: 'Flamant rose'
  };
  if (userMap[userId]) return userMap[userId];
  const animalTypes = ['Fourmi', 'Chien', 'Chat', 'Dauphin', 'Requin',
    'Écureuil', 'Sardine', 'Poisson', 'Lapin', 'Panda', 'Tigre',
    'Lion', 'Aigle', 'Singe', 'Zèbre', 'Girafe', 'Hippopotame',
    'Crocodile', 'Flamant'];
  const animalIndex = (userId - 1) % animalTypes.length;
  return animalTypes[animalIndex] || `Utilisateur ${userId}`;
}
}

