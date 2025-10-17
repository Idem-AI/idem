import { Component, signal, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SeoService } from '../../../../shared/services/seo.service';

interface DeploymentScreenshot {
  id: string;
  mode: string;
  title: string;
  description: string;
  imageUrl: string;
  features: string[];
  color: string;
}

@Component({
  selector: 'app-deployment-screenshots',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './deployment-screenshots.html',
  styleUrl: './deployment-screenshots.css',
})
export class DeploymentScreenshots implements OnInit, OnDestroy {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // State properties
  protected readonly activeScreenshot = signal<number>(0);
  private rotationInterval?: number;

  protected readonly screenshots = signal<DeploymentScreenshot[]>([
    {
      id: 'conversational-ui',
      mode: 'AI Assistant',
      title: 'Conversational Interface',
      description:
        'Natural language interaction with AI-powered architecture suggestions and real-time guidance.',
      imageUrl: '/assets/screenshots/conversational-mode.png',
      features: [
        'Chat-based interface',
        'Real-time AI responses',
        'Architecture visualization',
        'Step-by-step guidance',
      ],
      color: '#1447e6',
    },
    {
      id: 'quick-deploy-ui',
      mode: 'Quick Deploy',
      title: 'One-Click Deployment',
      description: 'Streamlined interface for instant deployment with minimal user input required.',
      imageUrl: '/assets/screenshots/quick-deploy-mode.png',
      features: [
        'Single-click deployment',
        'Progress indicators',
        'Automatic configuration',
        'Instant results',
      ],
      color: '#22c55e',
    },
    {
      id: 'templates-ui',
      mode: 'Architecture Templates',
      title: 'Template Selection',
      description:
        'Gallery of pre-built architecture templates with customization options and preview capabilities.',
      imageUrl: '/assets/screenshots/templates-mode.png',
      features: [
        'Template gallery',
        'Live preview',
        'Customization panel',
        'Architecture diagrams',
      ],
      color: '#d11ec0',
    },
    {
      id: 'expert-ui',
      mode: 'Component Catalog',
      title: 'Advanced Configuration',
      description:
        'Comprehensive component catalog with detailed configuration options and dependency management.',
      imageUrl: '/assets/screenshots/expert-mode.png',
      features: [
        'Component library',
        'Advanced settings',
        'Dependency graph',
        'Custom configurations',
      ],
      color: '#f59e0b',
    },
  ]);

  ngOnInit(): void {
    this.setupSeoForDeploymentScreenshots();
    this.startAutoRotation();
  }

  ngOnDestroy(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = undefined;
    }
  }

  private startAutoRotation(): void {
    this.rotationInterval = window.setInterval(() => {
      const screenshots = this.screenshots();
      const current = this.activeScreenshot();
      const next = (current + 1) % screenshots.length;
      this.activeScreenshot.set(next);
    }, 6000);
  }

  protected selectScreenshot(index: number): void {
    this.activeScreenshot.set(index);
  }

  protected getCurrentScreenshot(): DeploymentScreenshot {
    return this.screenshots()[this.activeScreenshot()];
  }

  private setupSeoForDeploymentScreenshots(): void {
    // Add structured data for deployment screenshots
    const deploymentStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Idem Deployment Interface',
      description:
        'Multiple deployment modes including AI assistant, quick deploy, templates, and expert configuration',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web Browser',
      featureList: this.screenshots().map((screenshot) => screenshot.title),
      screenshot: this.screenshots().map((screenshot) => ({
        '@type': 'ImageObject',
        name: screenshot.title,
        description: screenshot.description,
        url: `${this.seoService.domain}${screenshot.imageUrl}`,
      })),
    };

    // Add structured data to page if not already present
    if (
      this.isBrowser() &&
      !document.querySelector('script[data-deployment-screenshots-structured-data]')
    ) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-deployment-screenshots-structured-data', 'true');
      script.textContent = JSON.stringify(deploymentStructuredData);
      document.head.appendChild(script);
    }
  }
}
