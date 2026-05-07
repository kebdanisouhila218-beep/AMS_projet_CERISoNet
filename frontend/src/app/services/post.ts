import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Service PostService
 * Gère toutes les requêtes HTTP liées aux posts :
 * récupération, création, like, commentaire, partage, upload
 */
@Injectable({ providedIn: 'root' })
export class PostService {

  /** URL de base du serveur backend */
  private baseUrl = 'https://pedago.univ-avignon.fr:3170';

  /** Options HTTP : envoi des cookies de session avec chaque requête */
  private httpOptions = {
    withCredentials: true
  };

  constructor(private http: HttpClient) {}

  /**
   * Récupère la liste des posts avec pagination et filtres
   * @param page - Numéro de page (défaut: 1)
   * @param sort - Tri : 'recent' ou 'oldest' (défaut: 'recent')
   * @param hashtag - Filtre par hashtag (optionnel)
   * @param author - Filtre par auteur (optionnel)
   */
  getPosts(page: number = 1, sort: string = 'recent', hashtag: string = '', author: string = ''): Observable<any> {
    let params = `page=${page}&sort=${sort}`;
    if (hashtag) params += `&hashtag=${encodeURIComponent(hashtag)}`; // encode les caractères spéciaux
    if (author)  params += `&author=${encodeURIComponent(author)}`;
    return this.http.get<any>(`${this.baseUrl}/posts?${params}`, this.httpOptions);
  }

  /**
   * Récupère la liste de tous les hashtags disponibles
   * Utilisée pour remplir le filtre hashtag dans FilterBar
   */
  getHashtags(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/posts/hashtags`, this.httpOptions);
  }

  /**
   * Récupère la liste de tous les auteurs disponibles
   * Utilisée pour remplir le filtre auteur dans FilterBar
   */
  getAuthors(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/posts/authors`, this.httpOptions);
  }

  /**
   * Crée un nouveau post
   * @param postData - Données du post (body, hashtags, image)
   */
  createPost(postData: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts/new`, postData, this.httpOptions);
  }

  /**
   * Upload une image sur le serveur
   * @param file - Fichier image sélectionné par l'utilisateur
   */
  uploadImage(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', file); // encapsule le fichier dans un FormData
    return this.http.post<any>(`${this.baseUrl}/upload`, formData, this.httpOptions);
  }

  /**
   * Ajoute un commentaire sur un post
   * @param postId - ID du post ciblé
   * @param text - Texte du commentaire
   */
  addComment(postId: string, text: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts/${postId}/comment`, { text }, this.httpOptions);
  }

  /**
   * Like ou unlike un post selon l'état actuel
   * @param postId - ID du post ciblé
   */
  toggleLike(postId: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/posts/${postId}/like`, {}, this.httpOptions);
  }

  /**
   * Partage un post en créant un nouveau post avec référence au post original
   * @param postId - ID du post à partager
   * @param body - Message personnalisé du partage
   */
  sharePost(postId: string, body: string): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/posts/share`,
      { sharedPostId: postId, body },
      this.httpOptions
    );
  }

  /**
   * Retourne le pseudo d'un utilisateur à partir de son ID
   * Utilise une map fixe pour les 20 premiers utilisateurs
   * Génère un pseudo animal automatiquement pour les autres
   * @param userId - ID de l'utilisateur
   */
  getUserPseudo(userId: number): string {
    // Si userId absent, retourne Anonyme
    if (!userId) return 'Anonyme';

    // Map fixe des 20 premiers utilisateurs connus
    const userMap: { [key: number]: string } = {
      1: 'Fourmi', 2: 'Chien gris', 3: 'Chat noir', 4: 'Dauphin blanc',
      5: 'Requin noir', 6: 'Écureuil blanc', 7: 'Sardine grise',
      8: 'Poisson chat blanc', 9: 'Écureuil blanc', 10: 'Lapin rose',
      11: 'Panda géant', 12: 'Tigre blanc', 13: 'Lion doré',
      14: 'Aigle royal', 15: 'Singe bleu', 16: 'Zèbre rayé',
      17: 'Girafe jaune', 18: 'Hippopotame rose', 19: 'Crocodile vert',
      20: 'Flamant rose'
    };

    // Retourne le pseudo fixe si l'utilisateur est dans la map
    if (userMap[userId]) return userMap[userId];

    // Génère un pseudo automatique avec modulo pour les utilisateurs inconnus
    const animalTypes = ['Fourmi', 'Chien', 'Chat', 'Dauphin', 'Requin',
      'Écureuil', 'Sardine', 'Poisson', 'Lapin', 'Panda', 'Tigre',
      'Lion', 'Aigle', 'Singe', 'Zèbre', 'Girafe', 'Hippopotame',
      'Crocodile', 'Flamant'];

    const animalIndex = (userId - 1) % animalTypes.length;
    return animalTypes[animalIndex] || `Utilisateur ${userId}`;
  }
}