import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { SeoService } from '../../../../shared/services/seo.service';
import { Router, ActivatedRoute } from '@angular/router';
import { LoginCardComponent } from '../../components/login-card/login-card';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, LoginCardComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly seoService = inject(SeoService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  // Check if the app is in beta mode from environment
  protected readonly isBeta = signal(environment.isBeta);
  private readonly router = inject(Router);
  // Get waitlist form URL from environment
  protected readonly waitlistFormUrl = signal(environment.waitlistUrl);
  private redirectTarget: string | null = null;

  ngOnInit(): void {
    this.redirectTarget = this.route.snapshot.queryParamMap.get('redirect');
    this.setupSeo();
  }

  private setupSeo(): void {
    if (this.isBeta()) {
      // SEO for the standard login page
      const title = 'Login - Idem';
      const description = 'Access your Idem account to manage your AI-powered projects and brands.';
      this.seoService.updateTitle(title);
      this.seoService.updateMetaTags([
        { name: 'description', content: description },
        {
          name: 'keywords',
          content: 'Idem, Login, Sign In, Account, AI Project Management',
        },
        { name: 'robots', content: 'noindex, follow' }, // Discourage indexing of login pages
      ]);
      this.seoService.setCanonicalUrl('/login');
    } else {
      // SEO for the waitlist page
      const title = 'Join the Idem Waitlist - Early Access to AI Brand Creation';
      const description =
        'Get exclusive early access to Idem, the AI platform that builds your brand, creates technical specs, and deploys your app. Limited spots available!';
      this.seoService.updateTitle(title);
      this.seoService.updateMetaTags([
        { name: 'description', content: description },
        {
          name: 'keywords',
          content: 'Idem, Waitlist, Early Access, Beta, AI Brand Creation, AI Deployment, SaaS',
        },
        { name: 'robots', content: 'index, follow' },
      ]);
      this.seoService.updateOgTags([
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: `${this.seoService.domain}/login` },
        {
          property: 'og:image',
          content: `${this.seoService.domain}/assets/seo/og-image.jpg`,
        },
      ]);
      this.seoService.setCanonicalUrl('/login');
    }
  }

  // Open waitlist form in a new tab
  protected openWaitlistForm(): void {
    window.open(this.waitlistFormUrl(), '_blank');
  }

  protected async onLoginSuccess(): Promise<void> {
    try {
      // Check if we need to redirect to iDeploy
      if (this.redirectTarget === 'ideploy') {
        await this.handleIdeployRedirect();
        return;
      }

      // Default: navigate to console
      await this.router.navigate(['/console']);
    } catch (error) {
      console.error('Error navigating after login:', error);
    }
  }

  private async handleIdeployRedirect(): Promise<void> {
    try {
      console.log('Generating iDeploy SSO token...');
      const apiUrl = environment.services.api.url;
      const ideployUrl = environment.services.ideploy.url;

      // Call API to generate one-time token
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; token: string }>(
          `${apiUrl}/auth/ideploy-token`,
          {},
          { withCredentials: true },
        ),
      );

      if (response.success && response.token) {
        console.log('iDeploy SSO token generated, redirecting...');
        // Redirect to iDeploy with token
        window.location.href = `${ideployUrl}/auth/idem?token=${response.token}`;
      } else {
        console.error('Failed to generate iDeploy token');
        await this.router.navigate(['/console']);
      }
    } catch (error) {
      console.error('Error generating iDeploy SSO token:', error);
      // Fallback to console on error
      await this.router.navigate(['/console']);
    }
  }
}
