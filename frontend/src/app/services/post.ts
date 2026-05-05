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
}