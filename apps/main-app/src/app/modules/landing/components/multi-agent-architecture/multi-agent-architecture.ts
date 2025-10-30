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
      name: 'Design Agents',
      icon: 'pi-palette',
      color: 'var(--color-primary)',
      count: '50+',
      description:
        'Create stunning logos, brand identities, and UI designs in seconds. Professional-grade visuals without hiring a designer.',
      agents: [
        'Logo Generator',
        'Color Palette Designer',
        'Typography Specialist',
        'Brand Identity Expert',
        'UI/UX Designer',
      ],
    },
    {
      id: 'business',
      name: 'Business Agents',
      icon: 'pi-briefcase',
      color: 'var(--color-primary)',
      count: '40+',
      description:
        'Generate complete business plans with market analysis and financial projections. Investor-ready documents in minutes.',
      agents: [
        'Business Plan Writer',
        'Market Analyst',
        'Financial Projector',
        'Competitive Analyst',
        'Revenue Modeler',
      ],
    },
    {
      id: 'code',
      name: 'Code Agents',
      icon: 'pi-code',
      color: 'var(--color-primary)',
      count: '60+',
      description:
        'Build complete web applications from frontend to backend. Production-ready code that scales from day one.',
      agents: [
        'Frontend Developer',
        'Backend Developer',
        'Database Architect',
        'API Designer',
        'Code Optimizer',
      ],
    },
    {
      id: 'devops',
      name: 'DevOps Agents',
      icon: 'pi-server',
      color: 'var(--color-primary)',
      count: '30+',
      description:
        'Deploy to any cloud provider with one click. Automated infrastructure that scales with your growth.',
      agents: [
        'Cloud Architect',
        'Deployment Specialist',
        'Infrastructure Manager',
        'Security Expert',
        'Monitoring Agent',
      ],
    },
    {
      id: 'content',
      name: 'Content Agents',
      icon: 'pi-file-edit',
      color: 'var(--color-primary)',
      count: '20+',
      description:
        'Generate professional documentation, marketing copy, and SEO-optimized content. Launch-ready materials instantly.',
      agents: [
        'Documentation Writer',
        'Copywriter',
        'SEO Specialist',
        'Content Strategist',
        'Technical Writer',
      ],
    },
  ];

  protected readonly selectedCategory = signal(this.agentCategories[0]);

  protected selectCategory(category: (typeof this.agentCategories)[0]): void {
    this.selectedCategory.set(category);
  }

  protected nextCategory(): void {
    const currentIndex = this.agentCategories.findIndex(
      (cat) => cat.id === this.selectedCategory().id
    );
    const nextIndex = (currentIndex + 1) % this.agentCategories.length;
    this.selectedCategory.set(this.agentCategories[nextIndex]);
    this.resetAutoRotate();
  }

  protected previousCategory(): void {
    const currentIndex = this.agentCategories.findIndex(
      (cat) => cat.id === this.selectedCategory().id
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
