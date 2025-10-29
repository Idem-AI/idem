import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-multi-agent-architecture',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './multi-agent-architecture.html',
  styleUrl: './multi-agent-architecture.css',
})
export class MultiAgentArchitectureComponent {
  protected readonly agentCategories = [
    {
      id: 'design',
      name: 'Design Agents',
      icon: 'pi-palette',
      color: '#ec4899',
      count: '50+',
      description: 'Specialized in visual identity, logo creation, color theory, and brand design',
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
      color: '#3b82f6',
      count: '40+',
      description: 'Expert in business planning, market analysis, and financial projections',
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
      color: '#10b981',
      count: '60+',
      description: 'Fullstack development, architecture design, and code generation',
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
      color: '#f59e0b',
      count: '30+',
      description: 'Infrastructure provisioning, deployment automation, and cloud orchestration',
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
      color: '#8b5cf6',
      count: '20+',
      description: 'Documentation, copywriting, and content generation',
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
}
