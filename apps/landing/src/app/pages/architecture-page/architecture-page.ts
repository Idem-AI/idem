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
      name: $localize`:@@architecture-page.agents.orchestrator.name:Orchestrator Agent`,
      role: $localize`:@@architecture-page.agents.orchestrator.role:Coordination & Planning`,
      description: $localize`:@@architecture-page.agents.orchestrator.description:Coordinates all agents and manages the overall project workflow`,
      icon: 'pi-sitemap',
      color: '#10b981',
      capabilities: [
        $localize`:@@architecture-page.agents.orchestrator.capability1:Task decomposition`,
        $localize`:@@architecture-page.agents.orchestrator.capability2:Agent coordination`,
        $localize`:@@architecture-page.agents.orchestrator.capability3:Workflow management`,
        $localize`:@@architecture-page.agents.orchestrator.capability4:Quality control`,
      ],
    },
    {
      name: $localize`:@@architecture-page.agents.research.name:Research Agent`,
      role: $localize`:@@architecture-page.agents.research.role:Market Analysis`,
      description: $localize`:@@architecture-page.agents.research.description:Conducts market research and competitive analysis`,
      icon: 'pi-search',
      color: '#3b82f6',
      capabilities: [
        $localize`:@@architecture-page.agents.research.capability1:Market research`,
        $localize`:@@architecture-page.agents.research.capability2:Competitor analysis`,
        $localize`:@@architecture-page.agents.research.capability3:Trend identification`,
        $localize`:@@architecture-page.agents.research.capability4:Data synthesis`,
      ],
    },
    {
      name: $localize`:@@architecture-page.agents.business.name:Business Agent`,
      role: $localize`:@@architecture-page.agents.business.role:Strategy & Planning`,
      description: $localize`:@@architecture-page.agents.business.description:Creates business plans, financial models, and go-to-market strategies`,
      icon: 'pi-chart-line',
      color: '#f59e0b',
      capabilities: [
        $localize`:@@architecture-page.agents.business.capability1:Business model design`,
        $localize`:@@architecture-page.agents.business.capability2:Financial projections`,
        $localize`:@@architecture-page.agents.business.capability3:GTM strategy`,
        $localize`:@@architecture-page.agents.business.capability4:Risk assessment`,
      ],
    },
    {
      name: $localize`:@@architecture-page.agents.design.name:Design Agent`,
      role: $localize`:@@architecture-page.agents.design.role:Visual Identity`,
      description: $localize`:@@architecture-page.agents.design.description:Generates logos, brand guidelines, and visual assets`,
      icon: 'pi-palette',
      color: '#8b5cf6',
      capabilities: [
        $localize`:@@architecture-page.agents.design.capability1:Logo generation`,
        $localize`:@@architecture-page.agents.design.capability2:Brand identity`,
        $localize`:@@architecture-page.agents.design.capability3:Color schemes`,
        $localize`:@@architecture-page.agents.design.capability4:Typography selection`,
      ],
    },
    {
      name: $localize`:@@architecture-page.agents.technical.name:Technical Agent`,
      role: $localize`:@@architecture-page.agents.technical.role:Architecture & Code`,
      description: $localize`:@@architecture-page.agents.technical.description:Designs system architecture and generates technical documentation`,
      icon: 'pi-code',
      color: '#ec4899',
      capabilities: [
        $localize`:@@architecture-page.agents.technical.capability1:System architecture`,
        $localize`:@@architecture-page.agents.technical.capability2:Tech stack selection`,
        $localize`:@@architecture-page.agents.technical.capability3:API design`,
        $localize`:@@architecture-page.agents.technical.capability4:Documentation`,
      ],
    },
    {
      name: $localize`:@@architecture-page.agents.content.name:Content Agent`,
      role: $localize`:@@architecture-page.agents.content.role:Content Creation`,
      description: $localize`:@@architecture-page.agents.content.description:Generates website content, copy, and marketing materials`,
      icon: 'pi-file-edit',
      color: '#06b6d4',
      capabilities: [
        $localize`:@@architecture-page.agents.content.capability1:Website copy`,
        $localize`:@@architecture-page.agents.content.capability2:Marketing content`,
        $localize`:@@architecture-page.agents.content.capability3:SEO optimization`,
        $localize`:@@architecture-page.agents.content.capability4:Multilingual support`,
      ],
    },
  ];

  protected readonly features: ArchitectureFeature[] = [
    {
      title: $localize`:@@architecture-page.features.parallel.title:Parallel Processing`,
      description: $localize`:@@architecture-page.features.parallel.description:Multiple agents work simultaneously for faster results`,
      icon: 'pi-bolt',
    },
    {
      title: $localize`:@@architecture-page.features.expertise.title:Specialized Expertise`,
      description: $localize`:@@architecture-page.features.expertise.description:Each agent is optimized for specific tasks`,
      icon: 'pi-star',
    },
    {
      title: $localize`:@@architecture-page.features.qa.title:Quality Assurance`,
      description: $localize`:@@architecture-page.features.qa.description:Built-in validation and quality checks`,
      icon: 'pi-verified',
    },
    {
      title: $localize`:@@architecture-page.features.scalable.title:Scalable Architecture`,
      description: $localize`:@@architecture-page.features.scalable.description:Easily add new agents and capabilities`,
      icon: 'pi-chart-line',
    },
  ];

  protected readonly stats = [
    { value: '6+', label: $localize`:@@architecture-page.stats.agents:Specialized Agents` },
    { value: '10x', label: $localize`:@@architecture-page.stats.faster:Faster than Manual` },
    { value: '99%', label: $localize`:@@architecture-page.stats.successRate:Task Success Rate` },
    { value: '24/7', label: $localize`:@@architecture-page.stats.available:Always Available` },
  ];

  ngOnInit(): void {
    this.setupSeo();
  }

  private setupSeo(): void {
    const title = $localize`:@@architecture-page.seo.title:Multi-Agent AI Architecture | IDEM - Intelligent Collaboration`;
    const description = $localize`:@@architecture-page.seo.description:IDEM uses advanced multi-agent architecture with specialized AI agents working together. Orchestrator, Research, Business, Design, Technical, and Content agents collaborate for comprehensive project delivery.`;

    const metaTags = [
      { name: 'description', content: description },
      {
        name: 'keywords',
        content: $localize`:@@architecture-page.seo.keywords:multi-agent AI, AI architecture, specialized agents, orchestrator agent, AI collaboration, parallel processing, intelligent agents, AI workflow, agent coordination, scalable AI`,
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
