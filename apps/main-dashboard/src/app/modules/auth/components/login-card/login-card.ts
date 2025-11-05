import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Loader } from 'apps/main-dashboard/src/app/shared/components/loader/loader';

@Component({
  selector: 'app-login-card',
  standalone: true,
  imports: [CommonModule, Loader],
  templateUrl: './login-card.html',
  styleUrl: './login-card.css',
})
export class LoginCardComponent {
  protected readonly authService = inject(AuthService);
  protected isLoading = signal<boolean>(false);

  // Output to notify parent when login is successful
  readonly loginSuccess = output<void>();

  protected async loginWithGoogle(): Promise<void> {
    try {
      this.isLoading.set(true);
      await this.authService.loginWithGoogle();
      this.loginSuccess.emit();
    } catch (error) {
      console.error('Error logging in with Google:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async loginWithGithub(): Promise<void> {
    try {
      this.isLoading.set(true);
      await this.authService.loginWithGithub();
      this.loginSuccess.emit();
    } catch (error) {
      console.error('Error logging in with GitHub:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
