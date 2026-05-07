import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Notification } from '../notification/notification';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, Notification],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email: string = '';
  password: string = '';

  constructor(private router: Router, private http: HttpClient, private authService: Auth) {}

  onLogin() {
    if (!this.email || !this.password) {
      this.authService.showNotification('Veuillez remplir tous les champs', 'error');
      return;
    }

    const url = `https://pedago.univ-avignon.fr:3170/login?email=${encodeURIComponent(this.email)}&password=${encodeURIComponent(this.password)}`;
//credentiels Envoie les cookies 
    this.http.get<any>(url, { withCredentials: true }).subscribe({  
      next: (response) => {
        if (response.success) {
          const derniereConnexion = localStorage.getItem('derniereConnexion');
          const maintenant = new Date().toLocaleString('fr-FR');
          localStorage.setItem('derniereConnexion', maintenant);
        localStorage.setItem('userPseudo', response.pseudo); 
          if (derniereConnexion) {
            this.authService.showNotification(`Bienvenue ${response.pseudo} ! Dernière connexion le ${derniereConnexion}`, 'success');
          } else {
            this.authService.showNotification(`Bienvenue ${response.pseudo} ! Première connexion`, 'success');
          }

          this.router.navigate(['/wall']);
        } else {
          this.authService.showNotification('Email ou mot de passe incorrect', 'error');
        }
      },
      error: (err) => {
        console.log('Erreur de connexion:', err);
        this.authService.showNotification('Erreur de connexion, veuillez réessayer', 'error');
      }
    });
  }
}