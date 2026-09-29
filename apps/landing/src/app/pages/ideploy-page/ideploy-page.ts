import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-ideploy-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ideploy-page.html',
  styleUrl: './ideploy-page.css',
})
export class IdeployPage {

  protected readonly idevUrl = environment.services.idev.url;
  protected readonly ideployUrl = environment.services.ideploy.url;
  protected readonly dashboardUrl = environment.services.dashboard.url;

  readonly deployMethods = [
    {
      id: 'quick',
      title: $localize`:@@ideploy.method1.title:Quick Deploy`,
      description: $localize`:@@ideploy.method1.description:Zero configuration. Get a live URL in under 90 seconds with automatic SSL and CDN.`,
      badge: $localize`:@@ideploy.method1.badge:Fastest`,
      stats: [
        { label: $localize`:@@ideploy.method1.stat1:Config Time`, value: '0s' },
        { label: $localize`:@@ideploy.method1.stat2:Deploy Time`, value: '< 2min' },
      ],
    },
    {
      id: 'vps',
      title: $localize`:@@ideploy.method2.title:VPS Deployment`,
      description: $localize`:@@ideploy.method2.description:Deploy on IDEM servers or your own VPS with Docker Swarm high availability and full monitoring.`,
      badge: $localize`:@@ideploy.method2.badge:Full Control`,
      stats: [
        { label: $localize`:@@ideploy.method2.stat1:Uptime`, value: '99.9%' },
        { label: $localize`:@@ideploy.method2.stat2:HA`, value: 'Docker Swarm' },
      ],
    },
    {
      id: 'cloud',
      title: $localize`:@@ideploy.method3.title:Cloud Deploy`,
      description: $localize`:@@ideploy.method3.description:AI-powered deployment on AWS, GCP, or Azure with automatic resource provisioning and cost optimization.`,
      badge: $localize`:@@ideploy.method3.badge:AI-Optimized`,
      stats: [
        { label: $localize`:@@ideploy.method3.stat1:Cost Savings`, value: '~35%' },
        { label: $localize`:@@ideploy.method3.stat2:Providers`, value: '3+' },
      ],
    },
  ];

  readonly features = [
    {
      title: $localize`:@@ideploy.feature1.title:One-Click Deploy`,
      description: $localize`:@@ideploy.feature1.description:Push your application live with a single click. No configuration, no DevOps expertise required.`,
    },
    {
      title: $localize`:@@ideploy.feature2.title:Custom Domains & SSL`,
      description: $localize`:@@ideploy.feature2.description:Connect your own domain with automatic SSL certificate provisioning and renewal.`,
    },
    {
      title: $localize`:@@ideploy.feature3.title:Full Monitoring`,
      description: $localize`:@@ideploy.feature3.description:Real-time logs, resource usage, uptime monitoring, and instant alerts when something goes wrong.`,
    },
    {
      title: $localize`:@@ideploy.feature4.title:Auto Scaling`,
      description: $localize`:@@ideploy.feature4.description:Automatic resource scaling based on traffic. Your app handles peak load without manual intervention.`,
    },
    {
      title: $localize`:@@ideploy.feature5.title:Multiple Environments`,
      description: $localize`:@@ideploy.feature5.description:Staging, preview, and production environments with easy promotion between stages.`,
    },
    {
      title: $localize`:@@ideploy.feature6.title:iCode Integration`,
      description: $localize`:@@ideploy.feature6.description:Seamlessly deploy applications built with iCode. The perfect end-to-end workflow.`,
    },
  ];


}
