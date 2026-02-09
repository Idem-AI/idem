import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-multi-agent-architecture',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './multi-agent-architecture.html',
  styleUrl: './multi-agent-architecture.css',
})
export class MultiAgentArchitectureComponent implements OnInit, OnDestroy {
  private autoRotateInterval?: ReturnType<typeof setInterval>;
  private progressInterval?: ReturnType<typeof setInterval>;
  protected autoRotateProgress = 0;
  protected readonly agentCategories = [
    {
      id: 'design',
      name: $localize`:@@multi-agent-architecture.categories.design.name:Design Agents`,
      icon: 'pi-palette',
      color: 'var(--color-primary)',
      count: '50+',
      description: $localize`:@@multi-agent-architecture.categories.design.description:Create stunning logos, brand identities, and UI designs in seconds. Professional-grade visuals without hiring a designer.`,
      agents: [
        $localize`:@@multi-agent-architecture.categories.design.agent1:Logo Generator`,
        $localize`:@@multi-agent-architecture.categories.design.agent2:Color Palette Designer`,
        $localize`:@@multi-agent-architecture.categories.design.agent3:Typography Specialist`,
        $localize`:@@multi-agent-architecture.categories.design.agent4:Brand Identity Expert`,
        $localize`:@@multi-agent-architecture.categories.design.agent5:UI Component Designer`,
        $localize`:@@multi-agent-architecture.categories.design.agent6:Icon Designer`,
        $localize`:@@multi-agent-architecture.categories.design.agent7:Layout Architect`,
        $localize`:@@multi-agent-architecture.categories.design.agent8:Visual Hierarchy Specialist`,
        $localize`:@@multi-agent-architecture.categories.design.agent9:Responsive Design Expert`,
        $localize`:@@multi-agent-architecture.categories.design.agent10:Design System Builder`,
      ],
    },
    {
      id: 'business',
      name: $localize`:@@multi-agent-architecture.categories.business.name:Business Agents`,
      icon: 'pi-briefcase',
      color: 'var(--color-primary)',
      count: '40+',
      description: $localize`:@@multi-agent-architecture.categories.business.description:Generate complete business plans with market analysis and financial projections. Investor-ready documents in minutes.`,
      agents: [
        $localize`:@@multi-agent-architecture.categories.business.agent1:Business Plan Writer`,
        $localize`:@@multi-agent-architecture.categories.business.agent2:Market Research Analyst`,
        $localize`:@@multi-agent-architecture.categories.business.agent3:Financial Projector`,
        $localize`:@@multi-agent-architecture.categories.business.agent4:Competitive Intelligence Analyst`,
        $localize`:@@multi-agent-architecture.categories.business.agent5:Revenue Model Designer`,
        $localize`:@@multi-agent-architecture.categories.business.agent6:Legal Document Generator`,
        $localize`:@@multi-agent-architecture.categories.business.agent7:Pitch Deck Creator`,
        $localize`:@@multi-agent-architecture.categories.business.agent8:SWOT Analyst`,
        $localize`:@@multi-agent-architecture.categories.business.agent9:Go-to-Market Strategist`,
        $localize`:@@multi-agent-architecture.categories.business.agent10:Business Model Canvas Expert`,
      ],
    },
    {
      id: 'code',
      name: $localize`:@@multi-agent-architecture.categories.code.name:Code Agents`,
      icon: 'pi-code',
      color: 'var(--color-primary)',
      count: '60+',
      description: $localize`:@@multi-agent-architecture.categories.code.description:Build complete web applications from frontend to backend. Production-ready code that scales from day one.`,
      agents: [
        $localize`:@@multi-agent-architecture.categories.code.agent1:Frontend Developer`,
        $localize`:@@multi-agent-architecture.categories.code.agent2:Backend Developer`,
        $localize`:@@multi-agent-architecture.categories.code.agent3:Database Architect`,
        $localize`:@@multi-agent-architecture.categories.code.agent4:REST API Designer`,
        $localize`:@@multi-agent-architecture.categories.code.agent5:GraphQL Specialist`,
        $localize`:@@multi-agent-architecture.categories.code.agent6:Authentication Expert`,
        $localize`:@@multi-agent-architecture.categories.code.agent7:State Management Specialist`,
        $localize`:@@multi-agent-architecture.categories.code.agent8:Performance Optimizer`,
        $localize`:@@multi-agent-architecture.categories.code.agent9:Code Quality Analyzer`,
        $localize`:@@multi-agent-architecture.categories.code.agent10:Testing Automation Expert`,
      ],
    },
    {
      id: 'devops',
      name: $localize`:@@multi-agent-architecture.categories.devops.name:DevOps Agents`,
      icon: 'pi-server',
      color: 'var(--color-primary)',
      count: '30+',
      description: $localize`:@@multi-agent-architecture.categories.devops.description:Deploy to any cloud provider with one click. Automated infrastructure that scales with your growth.`,
      agents: [
        $localize`:@@multi-agent-architecture.categories.devops.agent1:Cloud Infrastructure Architect`,
        $localize`:@@multi-agent-architecture.categories.devops.agent2:CI/CD Pipeline Builder`,
        $localize`:@@multi-agent-architecture.categories.devops.agent3:Container Orchestrator`,
        $localize`:@@multi-agent-architecture.categories.devops.agent4:Security Hardening Expert`,
        $localize`:@@multi-agent-architecture.categories.devops.agent5:Monitoring & Logging Specialist`,
        $localize`:@@multi-agent-architecture.categories.devops.agent6:Auto-Scaling Manager`,
        $localize`:@@multi-agent-architecture.categories.devops.agent7:Backup & Recovery Specialist`,
        $localize`:@@multi-agent-architecture.categories.devops.agent8:SSL/TLS Configuration Expert`,
        $localize`:@@multi-agent-architecture.categories.devops.agent9:Domain & DNS Manager`,
        $localize`:@@multi-agent-architecture.categories.devops.agent10:Load Balancer Configurator`,
      ],
    },
    {
      id: 'content',
      name: $localize`:@@multi-agent-architecture.categories.content.name:Content Agents`,
      icon: 'pi-file-edit',
      color: 'var(--color-primary)',
      count: '20+',
      description: $localize`:@@multi-agent-architecture.categories.content.description:Generate professional documentation, marketing copy, and SEO-optimized content. Launch-ready materials instantly.`,
      agents: [
        $localize`:@@multi-agent-architecture.categories.content.agent1:Technical Documentation Writer`,
        $localize`:@@multi-agent-architecture.categories.content.agent2:Marketing Copywriter`,
        $localize`:@@multi-agent-architecture.categories.content.agent3:SEO Content Optimizer`,
        $localize`:@@multi-agent-architecture.categories.content.agent4:Content Strategy Planner`,
        $localize`:@@multi-agent-architecture.categories.content.agent5:API Documentation Specialist`,
        $localize`:@@multi-agent-architecture.categories.content.agent6:User Guide Creator`,
        $localize`:@@multi-agent-architecture.categories.content.agent7:Blog Post Writer`,
        $localize`:@@multi-agent-architecture.categories.content.agent8:Social Media Content Creator`,
        $localize`:@@multi-agent-architecture.categories.content.agent9:Email Campaign Writer`,
        $localize`:@@multi-agent-architecture.categories.content.agent10:Landing Page Copywriter`,
      ],
    },
  ];

  protected readonly selectedCategory = signal(this.agentCategories[0]);

  protected selectCategory(category: (typeof this.agentCategories)[0]): void {
    this.selectedCategory.set(category);
    this.resetAutoRotate();
  }

  protected nextCategory(): void {
    const currentIndex = this.agentCategories.findIndex(
      (cat) => cat.id === this.selectedCategory().id,
    );
    const nextIndex = (currentIndex + 1) % this.agentCategories.length;
    this.selectedCategory.set(this.agentCategories[nextIndex]);
    this.resetAutoRotate();
  }

  ngOnInit(): void {
    this.startAutoRotate();
  }

  ngOnDestroy(): void {
    this.stopAutoRotate();
    this.stopProgress();
  }

  private startAutoRotate(): void {
    this.autoRotateProgress = 0;
    this.startProgress();

    this.autoRotateInterval = setInterval(() => {
      this.nextCategory();
    }, 5000);
  }

  private stopAutoRotate(): void {
    if (this.autoRotateInterval) {
      clearInterval(this.autoRotateInterval);
    }
  }

  private startProgress(): void {
    this.autoRotateProgress = 0;
    this.progressInterval = setInterval(() => {
      this.autoRotateProgress += 2;
      if (this.autoRotateProgress >= 100) {
        this.autoRotateProgress = 100;
      }
    }, 100);
  }

  private stopProgress(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
  }

  private resetAutoRotate(): void {
    this.stopAutoRotate();
    this.stopProgress();
    this.startAutoRotate();
  }
}
