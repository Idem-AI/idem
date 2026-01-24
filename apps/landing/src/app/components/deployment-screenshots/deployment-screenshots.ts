import { Component, signal, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';

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
      mode: $localize`:@@deployment-screenshots.screenshots.quick.mode:Quick Deploy`,
      title: $localize`:@@deployment-screenshots.screenshots.quick.title:Quick Deployment`,
      description: $localize`:@@deployment-screenshots.screenshots.quick.description:Zero configuration deployment. We handle everything and provide you with a live URL instantly.`,
      imageUrl: '/assets/screenshots/quick-deploy.png',
      features: [
        $localize`:@@deployment-screenshots.screenshots.quick.feature1:Zero config`,
        $localize`:@@deployment-screenshots.screenshots.quick.feature2:Instant deployment`,
        $localize`:@@deployment-screenshots.screenshots.quick.feature3:Free subdomain`,
        $localize`:@@deployment-screenshots.screenshots.quick.feature4:Custom domain support`,
      ],
      color: '#10b981',
    },
    {
      id: 'vps-deploy',
      mode: $localize`:@@deployment-screenshots.screenshots.vps.mode:VPS`,
      title: $localize`:@@deployment-screenshots.screenshots.vps.title:VPS Deployment`,
      description: $localize`:@@deployment-screenshots.screenshots.vps.description:Deploy on IDEM servers or your own VPS with full control and Docker Swarm high availability.`,
      imageUrl: '/assets/screenshots/vps-deploy.png',
      features: [
        $localize`:@@deployment-screenshots.screenshots.vps.feature1:Your server or ours`,
        $localize`:@@deployment-screenshots.screenshots.vps.feature2:Docker Swarm`,
        $localize`:@@deployment-screenshots.screenshots.vps.feature3:Full monitoring`,
        $localize`:@@deployment-screenshots.screenshots.vps.feature4:Log management`,
      ],
      color: '#3b82f6',
    },
    {
      id: 'cloud-deploy',
      mode: $localize`:@@deployment-screenshots.screenshots.cloud.mode:Cloud Provider`,
      title: $localize`:@@deployment-screenshots.screenshots.cloud.title:Cloud Deployment`,
      description: $localize`:@@deployment-screenshots.screenshots.cloud.description:AI-powered deployment on AWS, GCP with automatic resource provisioning and cost optimization.`,
      imageUrl: '/assets/screenshots/cloud-deploy.png',
      features: [
        $localize`:@@deployment-screenshots.screenshots.cloud.feature1:AWS & GCP support`,
        $localize`:@@deployment-screenshots.screenshots.cloud.feature2:AI recommendations`,
        $localize`:@@deployment-screenshots.screenshots.cloud.feature3:Cost optimization`,
        $localize`:@@deployment-screenshots.screenshots.cloud.feature4:One-click deploy`,
      ],
      color: '#8b5cf6',
    },
    {
      id: 'architecture-deploy',
      mode: $localize`:@@deployment-screenshots.screenshots.architecture.mode:Architecture Design`,
      title: $localize`:@@deployment-screenshots.screenshots.architecture.title:Custom Architecture`,
      description: $localize`:@@deployment-screenshots.screenshots.architecture.description:Design and deploy custom cloud architectures with AI assistance, templates, or total control.`,
      imageUrl: '/assets/screenshots/architecture-deploy.png',
      features: [
        $localize`:@@deployment-screenshots.screenshots.architecture.feature1:AI Assistant`,
        $localize`:@@deployment-screenshots.screenshots.architecture.feature2:Pre-built templates`,
        $localize`:@@deployment-screenshots.screenshots.architecture.feature3:Custom config`,
        $localize`:@@deployment-screenshots.screenshots.architecture.feature4:Visual designer`,
      ],
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
      name: $localize`:@@deployment-screenshots.seo.name:Idem Deployment Solutions`,
      description: $localize`:@@deployment-screenshots.seo.description:Multiple deployment modes: Quick Deploy, VPS, Cloud Providers (AWS/GCP), and Custom Architecture Design`,
      applicationCategory: $localize`:@@deployment-screenshots.seo.appCategory:DeveloperApplication`,
      operatingSystem: $localize`:@@deployment-screenshots.seo.os:Web Browser`,
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
