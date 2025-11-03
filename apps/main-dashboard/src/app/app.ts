import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './shared/services/language.service';
import { AuthSyncService } from './shared/services/auth-sync.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('main-dashboard');
  private readonly languageService = inject(LanguageService);
  private readonly authSyncService = inject(AuthSyncService);

  ngOnInit(): void {
    // Check for auth synchronization from landing page
    this.authSyncService.checkAuthSync();
  }
}
