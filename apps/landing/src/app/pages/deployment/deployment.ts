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
      title: $localize`:@@deployment.modes.quick.title:Quick Deployment`,
      subtitle: $localize`:@@deployment.modes.quick.subtitle:Deploy in seconds with zero configuration`,
      description: $localize`:@@deployment.modes.quick.description:IDEM handles everything automatically. We build your application images, deploy them on our infrastructure, and provide you with a live URL. Your app is accessible at https://[your-app].idem.africa with the option to add your custom domain.`,
      icon: 'pi-bolt',
      color: '#10b981',
      features: [
        $localize`:@@deployment.modes.quick.feature1:Zero configuration required`,
        $localize`:@@deployment.modes.quick.feature2:Automatic image building`,
        $localize`:@@deployment.modes.quick.feature3:Instant deployment on IDEM servers`,
        $localize`:@@deployment.modes.quick.feature4:Free subdomain: [your-app].idem.africa`,
        $localize`:@@deployment.modes.quick.feature5:Custom domain support`,
        $localize`:@@deployment.modes.quick.feature6:SSL certificates included`,
        $localize`:@@deployment.modes.quick.feature7:Automatic scaling`,
        $localize`:@@deployment.modes.quick.feature8:Built-in monitoring`,
      ],
      targetAudience: $localize`:@@deployment.modes.quick.audience:Beginners, entrepreneurs, rapid prototyping`,
      useCases: [
        $localize`:@@deployment.modes.quick.useCase1:MVP launches`,
        $localize`:@@deployment.modes.quick.useCase2:Client demos`,
        $localize`:@@deployment.modes.quick.useCase3:Proof of concepts`,
        $localize`:@@deployment.modes.quick.useCase4:Quick testing environments`,
      ],
    },
    {
      id: 'vps',
      title: $localize`:@@deployment.modes.vps.title:VPS Deployment`,
      subtitle: $localize`:@@deployment.modes.vps.subtitle:Deploy on your own server or ours`,
      description: $localize`:@@deployment.modes.vps.description:Full control over your deployment with two options: deploy on IDEM VPS infrastructure or on your own VPS. We provide you with a deployment script that you execute on your server, and your application is generated and deployed.`,
      icon: 'pi-server',
      color: '#3b82f6',
      features: [
        $localize`:@@deployment.modes.vps.feature1:Deploy on IDEM VPS or your own server`,
        $localize`:@@deployment.modes.vps.feature2:Docker Swarm cluster for high availability`,
        $localize`:@@deployment.modes.vps.feature3:Complete container visualization on IDEM platform`,
        $localize`:@@deployment.modes.vps.feature4:Real-time application monitoring`,
        $localize`:@@deployment.modes.vps.feature5:Centralized log management`,
        $localize`:@@deployment.modes.vps.feature6:Flexible configuration options`,
        $localize`:@@deployment.modes.vps.feature7:Support for external projects`,
        $localize`:@@deployment.modes.vps.feature8:Intuitive setup for beginners`,
      ],
      targetAudience: $localize`:@@deployment.modes.vps.audience:Intermediate to advanced users, DevOps teams`,
      useCases: [
        $localize`:@@deployment.modes.vps.useCase1:Production deployments`,
        $localize`:@@deployment.modes.vps.useCase2:Custom infrastructure requirements`,
        $localize`:@@deployment.modes.vps.useCase3:Projects built outside IDEM`,
        $localize`:@@deployment.modes.vps.useCase4:High-availability applications`,
      ],
    },
    {
      id: 'cloud',
      title: $localize`:@@deployment.modes.cloud.title:Cloud Provider Deployment`,
      subtitle: $localize`:@@deployment.modes.cloud.subtitle:AI-powered deployment on AWS, GCP, and more`,
      description: $localize`:@@deployment.modes.cloud.description:IDEM connects to your cloud provider (AWS, GCP), creates necessary resources, and deploys your application. Our AI assistant collects your requirements and proposes an architecture aligned with your cost, performance, and scalability needs.`,
      icon: 'pi-cloud',
      color: '#8b5cf6',
      features: [
        $localize`:@@deployment.modes.cloud.feature1:Support for AWS, GCP, and more`,
        $localize`:@@deployment.modes.cloud.feature2:AI-powered architecture recommendations`,
        $localize`:@@deployment.modes.cloud.feature3:Cost optimization analysis`,
        $localize`:@@deployment.modes.cloud.feature4:Performance and scalability alignment`,
        $localize`:@@deployment.modes.cloud.feature5:Automatic resource provisioning`,
        $localize`:@@deployment.modes.cloud.feature6:One-click deployment`,
        $localize`:@@deployment.modes.cloud.feature7:Infrastructure as Code generation`,
        $localize`:@@deployment.modes.cloud.feature8:Multi-region support`,
      ],
      targetAudience: $localize`:@@deployment.modes.cloud.audience:All levels - AI guides you through the process`,
      useCases: [
        $localize`:@@deployment.modes.cloud.useCase1:Enterprise applications`,
        $localize`:@@deployment.modes.cloud.useCase2:Scalable microservices`,
        $localize`:@@deployment.modes.cloud.useCase3:Data-intensive workloads`,
        $localize`:@@deployment.modes.cloud.useCase4:Global deployments`,
      ],
    },
    {
      id: 'architecture',
      title: $localize`:@@deployment.modes.architecture.title:Architecture Design & Deployment`,
      subtitle: $localize`:@@deployment.modes.architecture.subtitle:Design and deploy custom cloud architectures`,
      description: $localize`:@@deployment.modes.architecture.description:Whether you're a data scientist, DevOps engineer, developer, or cloud architect, IDEM lets you design and deploy the exact architecture you need in just a few clicks. Choose from AI assistance, pre-built templates, or total custom configuration.`,
      icon: 'pi-sitemap',
      color: '#f59e0b',
      features: [
        $localize`:@@deployment.modes.architecture.feature1:AI Assistant mode for architecture recommendations`,
        $localize`:@@deployment.modes.architecture.feature2:Pre-built architecture templates`,
        $localize`:@@deployment.modes.architecture.feature3:Custom configuration mode (experimental)`,
        $localize`:@@deployment.modes.architecture.feature4:Visual architecture designer`,
        $localize`:@@deployment.modes.architecture.feature5:Infrastructure provisioning automation`,
        $localize`:@@deployment.modes.architecture.feature6:One-click deployment`,
        $localize`:@@deployment.modes.architecture.feature7:Cost estimation before deployment`,
        $localize`:@@deployment.modes.architecture.feature8:Best practices enforcement`,
      ],
      targetAudience: $localize`:@@deployment.modes.architecture.audience:Data scientists, DevOps, developers, cloud architects`,
      useCases: [
        $localize`:@@deployment.modes.architecture.useCase1:Complex multi-tier applications`,
        $localize`:@@deployment.modes.architecture.useCase2:Data pipelines and analytics`,
        $localize`:@@deployment.modes.architecture.useCase3:Custom infrastructure requirements`,
        $localize`:@@deployment.modes.architecture.useCase4:Optimized cloud architectures`,
      ],
    },
  ];

  protected readonly architectureModes = [
    {
      id: 'ai-assistant',
      title: $localize`:@@deployment.archModes.ai.title:AI Assistant Mode`,
      description: $localize`:@@deployment.archModes.ai.description:Describe your needs and our AI model proposes a perfectly aligned architecture. Deploy in one click. Perfect for beginners to advanced users who want robust, optimized architecture in minutes.`,
      icon: 'pi-sparkles',
      color: '#ec4899',
      audience: $localize`:@@deployment.archModes.ai.audience:All levels`,
    },
    {
      id: 'templates',
      title: $localize`:@@deployment.archModes.templates.title:Deployment Templates`,
      description: $localize`:@@deployment.archModes.templates.description:Choose from pre-defined architecture templates for different use cases. Customize as needed and orchestrate deployment in one click. Ideal for intermediate to advanced users.`,
      icon: 'pi-th-large',
      color: '#06b6d4',
      audience: $localize`:@@deployment.archModes.templates.audience:Intermediate to Advanced`,
    },
    {
      id: 'custom',
      title: $localize`:@@deployment.archModes.custom.title:Total Configuration (Experimental)`,
      description: $localize`:@@deployment.archModes.custom.description:Design your entire infrastructure in an intuitive interface (simpler than cloud providers). IDEM handles provisioning. For experienced users with strong cloud architecture knowledge.`,
      icon: 'pi-cog',
      color: '#f59e0b',
      audience: $localize`:@@deployment.archModes.custom.audience:Advanced`,
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
