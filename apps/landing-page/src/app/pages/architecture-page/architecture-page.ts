import { Component, inject, PLATFORM_ID, signal, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../shared/services/seo.service';

interface Agent {
  name: string;
  role: string;
  description: string;
  icon: string;
  color: string;
  capabilities: string[];
}

interface ArchitectureFeature {
  title: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-architecture-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './architecture-page.html',
  styleUrl: './architecture-page.css',
})
export class ArchitecturePage implements OnInit {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seoService = inject(SeoService);

  protected readonly agents: Agent[] = [
    {
      name: 'Orchestrator Agent',
      role: 'Coordination & Planning',
      description: 'Coordinates all agents and manages the overall project workflow',
      icon: 'pi-sitemap',
      color: '#10b981',
      capabilities: [
        'Task decomposition',
        'Agent coordination',
        'Workflow management',
        'Quality control',
      ],
    },
    {
      name: 'Research Agent',
      role: 'Market Analysis',
      description: 'Conducts market research and competitive analysis',
      icon: 'pi-search',
      color: '#3b82f6',
      capabilities: [
        'Market research',
        'Competitor analysis',
        'Trend identification',
        'Data synthesis',
      ],
    },
    {
      name: 'Business Agent',
      role: 'Strategy & Planning',
      description: 'Creates business plans, financial models, and go-to-market strategies',
      icon: 'pi-chart-line',
      color: '#f59e0b',
      capabilities: [
        'Business model design',
        'Financial projections',
        'GTM strategy',
        'Risk assessment',
      ],
    },
    {
      name: 'Design Agent',
      role: 'Visual Identity',
      description: 'Generates logos, brand guidelines, and visual assets',
      icon: 'pi-palette',
      color: '#8b5cf6',
      capabilities: ['Logo generation', 'Brand identity', 'Color schemes', 'Typography selection'],
    },
    {
      name: 'Technical Agent',
      role: 'Architecture & Code',
      description: 'Designs system architecture and generates technical documentation',
      icon: 'pi-code',
      color: '#ec4899',
      capabilities: ['System architecture', 'Tech stack selection', 'API design', 'Documentation'],
    },
    {
      name: 'Content Agent',
      role: 'Content Creation',
      description: 'Generates website content, copy, and marketing materials',
      icon: 'pi-file-edit',
      color: '#06b6d4',
      capabilities: [
        'Website copy',
        'Marketing content',
        'SEO optimization',
        'Multilingual support',
      ],
    },
  ];

  protected readonly features: ArchitectureFeature[] = [
    {
      title: 'Parallel Processing',
      description: 'Multiple agents work simultaneously for faster results',
      icon: 'pi-bolt',
    },
    {
      title: 'Specialized Expertise',
      description: 'Each agent is optimized for specific tasks',
      icon: 'pi-star',
    },
    {
      title: 'Quality Assurance',
      description: 'Built-in validation and quality checks',
      icon: 'pi-verified',
    },
    {
      title: 'Scalable Architecture',
      description: 'Easily add new agents and capabilities',
      icon: 'pi-chart-line',
    },
  ];

  protected readonly stats = [
    { value: '6+', label: 'Specialized Agents' },
    { value: '10x', label: 'Faster than Manual' },
    { value: '99%', label: 'Task Success Rate' },
    { value: '24/7', label: 'Always Available' },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title = 'Multi-Agent AI Architecture | IDEM - Intelligent Collaboration';
    const description =
      'IDEM uses advanced multi-agent architecture with specialized AI agents working together. Orchestrator, Research, Business, Design, Technical, and Content agents collaborate for comprehensive project delivery.';

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content:
          'multi-agent AI, AI architecture, specialized agents, orchestrator agent, AI collaboration, parallel processing, intelligent agents, AI workflow, agent coordination, scalable AI',
      },
    ];

    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${this.seoService.domain}/architecture` },
    ];

    this.seoService.updateTitle(title);
    this.seoService.updateMetaTags(metaTags);
    this.seoService.updateOgTags(ogTags);
    this.seoService.setCanonicalUrl('/architecture');
  }
}
