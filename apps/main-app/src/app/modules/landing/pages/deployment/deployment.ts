import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface DeploymentMode {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  targetAudience: string;
  useCases: string[];
}

@Component({
  selector: 'app-deployment',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './deployment.html',
  styleUrl: './deployment.css',
})
export class DeploymentPage {
  protected readonly selectedMode = signal<string>('quick');

  protected readonly deploymentModes: DeploymentMode[] = [
    {
      id: 'quick',
      title: 'Quick Deployment',
      subtitle: 'Deploy in seconds with zero configuration',
      description:
        'IDEM handles everything automatically. We build your application images, deploy them on our infrastructure, and provide you with a live URL. Your app is accessible at https://[your-app].idem.africa with the option to add your custom domain.',
      icon: 'pi-bolt',
      color: '#10b981',
      features: [
        'Zero configuration required',
        'Automatic image building',
        'Instant deployment on IDEM servers',
        'Free subdomain: [your-app].idem.africa',
        'Custom domain support',
        'SSL certificates included',
        'Automatic scaling',
        'Built-in monitoring',
      ],
      targetAudience: 'Beginners, entrepreneurs, rapid prototyping',
      useCases: ['MVP launches', 'Client demos', 'Proof of concepts', 'Quick testing environments'],
    },
    {
      id: 'vps',
      title: 'VPS Deployment',
      subtitle: 'Deploy on your own server or ours',
      description:
        'Full control over your deployment with two options: deploy on IDEM VPS infrastructure or on your own VPS. We provide you with a deployment script that you execute on your server, and your application is generated and deployed.',
      icon: 'pi-server',
      color: '#3b82f6',
      features: [
        'Deploy on IDEM VPS or your own server',
        'Docker Swarm cluster for high availability',
        'Complete container visualization on IDEM platform',
        'Real-time application monitoring',
        'Centralized log management',
        'Flexible configuration options',
        'Support for external projects',
        'Intuitive setup for beginners',
      ],
      targetAudience: 'Intermediate to advanced users, DevOps teams',
      useCases: [
        'Production deployments',
        'Custom infrastructure requirements',
        'Projects built outside IDEM',
        'High-availability applications',
      ],
    },
    {
      id: 'cloud',
      title: 'Cloud Provider Deployment',
      subtitle: 'AI-powered deployment on AWS, GCP, and more',
      description:
        'IDEM connects to your cloud provider (AWS, GCP), creates necessary resources, and deploys your application. Our AI assistant collects your requirements and proposes an architecture aligned with your cost, performance, and scalability needs.',
      icon: 'pi-cloud',
      color: '#8b5cf6',
      features: [
        'Support for AWS, GCP, and more',
        'AI-powered architecture recommendations',
        'Cost optimization analysis',
        'Performance and scalability alignment',
        'Automatic resource provisioning',
        'One-click deployment',
        'Infrastructure as Code generation',
        'Multi-region support',
      ],
      targetAudience: 'All levels - AI guides you through the process',
      useCases: [
        'Enterprise applications',
        'Scalable microservices',
        'Data-intensive workloads',
        'Global deployments',
      ],
    },
    {
      id: 'architecture',
      title: 'Architecture Design & Deployment',
      subtitle: 'Design and deploy custom cloud architectures',
      description:
        "Whether you're a data scientist, DevOps engineer, developer, or cloud architect, IDEM lets you design and deploy the exact architecture you need in just a few clicks. Choose from AI assistance, pre-built templates, or total custom configuration.",
      icon: 'pi-sitemap',
      color: '#f59e0b',
      features: [
        'AI Assistant mode for architecture recommendations',
        'Pre-built architecture templates',
        'Custom configuration mode (experimental)',
        'Visual architecture designer',
        'Infrastructure provisioning automation',
        'One-click deployment',
        'Cost estimation before deployment',
        'Best practices enforcement',
      ],
      targetAudience: 'Data scientists, DevOps, developers, cloud architects',
      useCases: [
        'Complex multi-tier applications',
        'Data pipelines and analytics',
        'Custom infrastructure requirements',
        'Optimized cloud architectures',
      ],
    },
  ];

  protected readonly architectureModes = [
    {
      id: 'ai-assistant',
      title: 'AI Assistant Mode',
      description:
        'Describe your needs and our AI model proposes a perfectly aligned architecture. Deploy in one click. Perfect for beginners to advanced users who want robust, optimized architecture in minutes.',
      icon: 'pi-sparkles',
      color: '#ec4899',
      audience: 'All levels',
    },
    {
      id: 'templates',
      title: 'Deployment Templates',
      description:
        'Choose from pre-defined architecture templates for different use cases. Customize as needed and orchestrate deployment in one click. Ideal for intermediate to advanced users.',
      icon: 'pi-th-large',
      color: '#06b6d4',
      audience: 'Intermediate to Advanced',
    },
    {
      id: 'custom',
      title: 'Total Configuration (Experimental)',
      description:
        'Design your entire infrastructure in an intuitive interface (simpler than cloud providers). IDEM handles provisioning. For experienced users with strong cloud architecture knowledge.',
      icon: 'pi-cog',
      color: '#f59e0b',
      audience: 'Advanced',
    },
  ];

  protected selectMode(modeId: string): void {
    this.selectedMode.set(modeId);
  }

  protected getSelectedMode(): DeploymentMode {
    return (
      this.deploymentModes.find((mode) => mode.id === this.selectedMode()) ||
      this.deploymentModes[0]
    );
  }
}
