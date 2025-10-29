import { Component, signal, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  imports: [CommonModule, RouterLink],
  templateUrl: './deployment-screenshots.html',
  styleUrl: './deployment-screenshots.css',
})
export class DeploymentScreenshots implements OnInit {
  // Angular-initialized properties
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  // State properties
  protected readonly screenshots = signal<DeploymentScreenshot[]>([
    {
      id: 'quick-deploy',
      mode: 'Quick Deploy',
      title: 'Quick Deployment',
      description:
        'Zero configuration deployment. We handle everything and provide you with a live URL instantly.',
      imageUrl: '/assets/screenshots/quick-deploy.png',
      features: ['Zero config', 'Instant deployment', 'Free subdomain', 'Custom domain support'],
      color: '#10b981',
    },
    {
      id: 'vps-deploy',
      mode: 'VPS',
      title: 'VPS Deployment',
      description:
        'Deploy on IDEM servers or your own VPS with full control and Docker Swarm high availability.',
      imageUrl: '/assets/screenshots/vps-deploy.png',
      features: ['Your server or ours', 'Docker Swarm', 'Full monitoring', 'Log management'],
      color: '#3b82f6',
    },
    {
      id: 'cloud-deploy',
      mode: 'Cloud Provider',
      title: 'Cloud Deployment',
      description:
        'AI-powered deployment on AWS, GCP with automatic resource provisioning and cost optimization.',
      imageUrl: '/assets/screenshots/cloud-deploy.png',
      features: [
        'AWS & GCP support',
        'AI recommendations',
        'Cost optimization',
        'One-click deploy',
      ],
      color: '#8b5cf6',
    },
    {
      id: 'architecture-deploy',
      mode: 'Architecture Design',
      title: 'Custom Architecture',
      description:
        'Design and deploy custom cloud architectures with AI assistance, templates, or total control.',
      imageUrl: '/assets/screenshots/architecture-deploy.png',
      features: ['AI Assistant', 'Pre-built templates', 'Custom config', 'Visual designer'],
      color: '#f59e0b',
    },
  ]);

  ngOnInit(): void {
    this.setupSeoForDeploymentScreenshots();
  }

  private setupSeoForDeploymentScreenshots(): void {
    // Add structured data for deployment modes
    const deploymentStructuredData = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Idem Deployment Solutions',
      description:
        'Multiple deployment modes: Quick Deploy, VPS, Cloud Providers (AWS/GCP), and Custom Architecture Design',
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
      !document.querySelector('script[data-deployment-modes-structured-data]')
    ) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-deployment-modes-structured-data', 'true');
      script.textContent = JSON.stringify(deploymentStructuredData);
      document.head.appendChild(script);
    }
  }
}
