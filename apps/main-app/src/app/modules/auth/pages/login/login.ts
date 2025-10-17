import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { SeoService } from '../../../../shared/services/seo.service';
import { Router } from '@angular/router';
import { LoginCardComponent } from '../../components/login-card/login-card';

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

  // Check if the app is in beta mode from environment
  protected readonly isBeta = signal(environment.isBeta);
  private readonly router = inject(Router);
  // Get waitlist form URL from environment
  protected readonly waitlistFormUrl = signal(environment.waitlistUrl);
  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    if (this.isBeta()) {
      // SEO for the standard login page
      const title = 'Login - Idem';
      const description =
        'Access your Idem account to manage your AI-powered projects and brands.';
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
      const title =
        'Join the Idem Waitlist - Early Access to AI Brand Creation';
      const description =
        'Get exclusive early access to Idem, the AI platform that builds your brand, creates technical specs, and deploys your app. Limited spots available!';
      this.seoService.updateTitle(title);
      this.seoService.updateMetaTags([
        { name: 'description', content: description },
        {
          name: 'keywords',
          content:
            'Idem, Waitlist, Early Access, Beta, AI Brand Creation, AI Deployment, SaaS',
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
      await this.router.navigate(['/console']);
    } catch (error) {
      console.error('Error navigating after login:', error);
    }
  }
}
