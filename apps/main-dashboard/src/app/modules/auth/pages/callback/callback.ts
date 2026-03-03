import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CasdoorService } from '../../../../shared/services/casdoor.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-900">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
        <p class="text-white text-lg">{{ message }}</p>
        @if (error) {
          <p class="text-red-500 mt-4">{{ error }}</p>
          <button 
            (click)="retry()"
            class="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
          >
            Réessayer
          </button>
        }
      </div>
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private casdoorService = inject(CasdoorService);

  message = 'Connexion en cours...';
  error = '';

  ngOnInit(): void {
    this.handleCallback();
  }

  private handleCallback(): void {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];

      if (error) {
        this.error = `Erreur d'authentification: ${error}`;
        this.message = '';
        return;
      }

      if (!code || !state) {
        this.error = 'Paramètres manquants dans l\'URL de callback';
        this.message = '';
        return;
      }

      this.message = 'Échange du code d\'autorisation...';

      this.casdoorService.exchangeCodeForToken(code, state).subscribe({
        next: () => {
          this.message = 'Récupération du profil utilisateur...';
          
          this.casdoorService.getUserProfile().subscribe({
            next: () => {
              this.message = 'Connexion réussie ! Redirection...';
              setTimeout(() => {
                this.router.navigate(['/dashboard']);
              }, 1000);
            },
            error: (err) => {
              console.error('Error fetching user profile:', err);
              this.error = 'Impossible de récupérer le profil utilisateur';
              this.message = '';
            }
          });
        },
        error: (err) => {
          console.error('Error exchanging code for token:', err);
          this.error = 'Impossible d\'échanger le code d\'autorisation';
          this.message = '';
        }
      });
    });
  }

  retry(): void {
    this.error = '';
    this.message = 'Redirection vers la page de connexion...';
    setTimeout(() => {
      this.router.navigate(['/auth/login']);
    }, 500);
  }
}
