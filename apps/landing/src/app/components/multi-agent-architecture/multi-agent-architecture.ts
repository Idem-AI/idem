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
        $localize`:@@multi-agent-architecture.categories.design.agent5:UI/UX Designer`,
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
        $localize`:@@multi-agent-architecture.categories.business.agent2:Market Analyst`,
        $localize`:@@multi-agent-architecture.categories.business.agent3:Financial Projector`,
        $localize`:@@multi-agent-architecture.categories.business.agent4:Competitive Analyst`,
        $localize`:@@multi-agent-architecture.categories.business.agent5:Revenue Modeler`,
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
        $localize`:@@multi-agent-architecture.categories.code.agent4:API Designer`,
        $localize`:@@multi-agent-architecture.categories.code.agent5:Code Optimizer`,
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
        $localize`:@@multi-agent-architecture.categories.devops.agent1:Cloud Architect`,
        $localize`:@@multi-agent-architecture.categories.devops.agent2:Deployment Specialist`,
        $localize`:@@multi-agent-architecture.categories.devops.agent3:Infrastructure Manager`,
        $localize`:@@multi-agent-architecture.categories.devops.agent4:Security Expert`,
        $localize`:@@multi-agent-architecture.categories.devops.agent5:Monitoring Agent`,
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
        $localize`:@@multi-agent-architecture.categories.content.agent1:Documentation Writer`,
        $localize`:@@multi-agent-architecture.categories.content.agent2:Copywriter`,
        $localize`:@@multi-agent-architecture.categories.content.agent3:SEO Specialist`,
        $localize`:@@multi-agent-architecture.categories.content.agent4:Content Strategist`,
        $localize`:@@multi-agent-architecture.categories.content.agent5:Technical Writer`,
      ],
    },
  ];

  protected readonly selectedCategory = signal(this.agentCategories[0]);

  protected selectCategory(category: (typeof this.agentCategories)[0]): void {
    this.selectedCategory.set(category);
  }

  protected nextCategory(): void {
    const currentIndex = this.agentCategories.findIndex(
      (cat) => cat.id === this.selectedCategory().id,
    );
    const nextIndex = (currentIndex + 1) % this.agentCategories.length;
    this.selectedCategory.set(this.agentCategories[nextIndex]);
    this.resetAutoRotate();
  }

  protected previousCategory(): void {
    const currentIndex = this.agentCategories.findIndex(
      (cat) => cat.id === this.selectedCategory().id,
    );
    const previousIndex = currentIndex === 0 ? this.agentCategories.length - 1 : currentIndex - 1;
    this.selectedCategory.set(this.agentCategories[previousIndex]);
    this.resetAutoRotate();
  }

  ngOnInit(): void {
    this.startAutoRotate();
  }

  ngOnDestroy(): void {
    this.stopAutoRotate();
  }

  private startAutoRotate(): void {
    this.autoRotateInterval = setInterval(() => {
      this.nextCategory();
    }, 5000);
  }

  private stopAutoRotate(): void {
    if (this.autoRotateInterval) {
      clearInterval(this.autoRotateInterval);
    }
  }

  private resetAutoRotate(): void {
    this.stopAutoRotate();
    this.startAutoRotate();
  }
}
