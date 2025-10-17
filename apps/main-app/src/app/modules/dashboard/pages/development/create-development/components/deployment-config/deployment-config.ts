import {
  ChangeDetectionStrategy,
  Component,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TechCardModel } from '../shared/tech-card';
import { ButtonModule } from 'primeng/button';
import { CreateDeployment } from '../../../../deployment/create-deployment/create-deployment';

@Component({
  selector: 'app-deployment-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, CreateDeployment],
  templateUrl: './deployment-config.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeploymentConfigComponent {
  // Input properties
  readonly deploymentForm = input<FormGroup>();
  readonly showAdvancedOptions = input<boolean>();
  readonly versionOptions = input<{
    [key: string]: { [key: string]: string[] };
  }>({});

  /**
   * Track whether form is valid for parent components
   */
  protected readonly formValid = computed(() => {
    return this.deploymentForm()?.valid ?? false;
  });

  /**
   * Get versions for the selected deployment platform
   */
  protected getDeploymentVersions(platformId: string): string[] {
    // Find the selected platform in our deploymentOptions array
    const platform = this.deploymentOptions.find((p) => p.id === platformId);
    // Return its versions if available
    if (platform?.versions) {
      return platform.versions;
    }
    return ['Latest'];
  }

  /**
   * Get versions for the selected CI/CD provider
   */
  protected getCicdVersions(cicdId: string): string[] {
    // Find the selected CI/CD option in our cicdOptions array
    const cicd = this.cicdOptions.find((c) => c.id === cicdId);
    // Return its versions if available
    if (cicd?.versions) {
      return cicd.versions;
    }
    return ['Latest'];
  }

  /**
   * Features list for easier form handling
   */
  protected readonly featuresList = [
    {
      id: 'monitoring',
      name: 'Monitoring',
      description: 'Application performance tracking',
    },
    {
      id: 'continuousDeployment',
      name: 'Continuous Deployment',
      description: 'Automatic deployment pipeline',
    },
    {
      id: 'ssl',
      name: 'SSL Certificates',
      description: 'HTTPS encryption',
    },
    {
      id: 'backups',
      name: 'Automated Backups',
      description: 'Regular data backup',
    },
    {
      id: 'logging',
      name: 'Centralized Logging',
      description: 'Log collection and analysis',
    },
    {
      id: 'scaling',
      name: 'Auto-scaling',
      description: 'Dynamic resource allocation',
    },
  ];

  /**
   * Deployment options
   */
  protected readonly deploymentOptions: TechCardModel[] = [
    {
      id: 'docker',
      name: 'Docker',
      icon: 'https://www.docker.com/wp-content/uploads/2022/03/vertical-logo-monochromatic.png',
      color: '#2496ED',
      description: 'Container-based deployment',
      badges: ['Containerization', 'Portable', 'Scalable'],
      versions: ['24.0', '23.0', '20.10'],
      isAvailable: true,
    },
    {
      id: 'kubernetes',
      name: 'Kubernetes',
      icon: 'https://kubernetes.io/images/favicon.svg',
      color: '#326CE5',
      description: 'Container orchestration platform',
      badges: ['Orchestration', 'Scalability', 'Self-healing'],
      versions: ['1.29', '1.28', '1.27', '1.26'],
      isAvailable: false,
    },
    {
      id: 'aws',
      name: 'AWS',
      icon: 'https://a0.awsstatic.com/libra-css/images/site/touch-icon-ipad-144-smile.png',
      color: '#FF9900',
      description: 'Amazon Web Services cloud',
      badges: ['EC2', 'Lambda', 'S3'],
      versions: ['Latest'],
      isAvailable: false,
    },
    {
      id: 'azure',
      name: 'Azure',
      icon: 'https://azure.microsoft.com/content/dam/microsoft/final/en-us/microsoft-brand/icons/Azure.svg',
      color: '#0078D4',
      description: 'Microsoft cloud platform',
      badges: ['App Service', 'Functions', 'Storage'],
      versions: ['Latest'],
      isAvailable: false,
    },
    {
      id: 'vercel',
      name: 'Vercel',
      icon: 'https://assets.vercel.com/image/upload/front/favicon/vercel/180x180.png',
      color: '#000000',
      description: 'Frontend deployment platform',
      badges: ['Edge Network', 'Serverless', 'Preview'],
      versions: ['Latest'],
      isAvailable: true,
    },
    {
      id: 'netlify',
      name: 'Netlify',
      icon: 'https://www.netlify.com/v3/img/components/logomark-dark.svg',
      color: '#00C7B7',
      description: 'Frontend deployment platform',
      badges: ['Continuous Deployment', 'Forms', 'Functions'],
      versions: ['Latest'],
      isAvailable: true,
    },
  ];

  /**
   * CI/CD options
   */
  protected readonly cicdOptions: TechCardModel[] = [
    {
      id: 'github',
      name: 'GitHub Actions',
      icon: 'https://github.githubassets.com/assets/actions-icon-actions-61925a4b8822.svg',
      color: '#2088FF',
      description: 'GitHub integrated CI/CD',
      badges: ['GitHub', 'Built-in', 'YAML'],
      isAvailable: true,
    },
    {
      id: 'gitlab',
      name: 'GitLab CI',
      icon: 'https://about.gitlab.com/images/press/logo/png/gitlab-icon-rgb.png',
      color: '#FC6D26',
      description: 'GitLab integrated pipelines',
      badges: ['GitLab', 'Built-in', 'YAML'],
      isAvailable: false,
    },
    {
      id: 'jenkins',
      name: 'Jenkins',
      icon: 'https://www.jenkins.io/images/logos/jenkins/jenkins.svg',
      color: '#D33833',
      description: 'Self-hosted automation server',
      badges: ['Self-hosted', 'Groovy', 'Plugins'],
      isAvailable: false,
    },
    {
      id: 'circleci',
      name: 'CircleCI',
      icon: 'https://d3r49iyjzglexf.cloudfront.net/circleci-logo-stacked-fb-657e221fda1646a7e652c09c9fbfb2b0feb5d710089bb4d8e8c759d37a832694.png',
      color: '#343434',
      description: 'Cloud-based CI/CD service',
      badges: ['Cloud', 'Orbs', 'YAML'],
      isAvailable: false,
    },
  ];
}
