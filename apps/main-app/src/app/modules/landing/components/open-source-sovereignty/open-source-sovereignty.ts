import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-open-source-sovereignty',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './open-source-sovereignty.html',
  styleUrl: './open-source-sovereignty.css',
})
export class OpenSourceSovereigntyComponent {
  protected readonly features = [
    {
      icon: 'pi-code',
      title: 'Complete Business Suite in One Platform',
      description:
        'From logo creation to full-stack web apps, IDEM handles every step. 200+ AI agents work together to build your brand, strategy, and product—all from a single idea.',
      benefits: [
        'Logo & brand identity generation',
        'Business plan creation',
        'Full web application development',
      ],
    },
    {
      icon: 'pi-shield',
      title: 'Deploy on Your Own Infrastructure',
      description:
        'Host on AWS, Google Cloud, Azure, or your own servers. Your code, your servers, your data. No external dependencies, no vendor lock-in.',
      benefits: [
        'Full source code access',
        'Deploy anywhere in minutes',
        'Complete data sovereignty',
      ],
    },
    {
      icon: 'pi-users',
      title: 'Built for African Entrepreneurs',
      description:
        'Designed in Cameroon with African markets in mind. Local payment integrations, multilingual support, and infrastructure optimized for African internet speeds.',
      benefits: [
        'African payment gateways ready',
        'Optimized for low bandwidth',
        'Community-driven development',
      ],
    },
    {
      icon: 'pi-dollar',
      title: 'From Idea to Revenue in Days',
      description:
        'What costs $50,000+ with agencies, IDEM delivers for free. Build your MVP, launch your startup, and start generating revenue—all without writing a single line of code.',
      benefits: ['Zero licensing fees', 'No monthly subscriptions', 'Launch in days, not months'],
    },
  ];
}
