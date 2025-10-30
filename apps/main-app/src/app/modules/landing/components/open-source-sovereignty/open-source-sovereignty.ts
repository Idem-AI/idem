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
      title: 'Complete Business Suite',
      description: '200+ AI agents build your brand, strategy, and product from a single idea.',
      benefits: ['Logo & brand identity', 'Business plans', 'Full-stack web apps'],
      image: 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg',
      imagePosition: 'left' as const,
    },
    {
      title: 'Deploy Anywhere',
      description:
        'Your code, your servers, your data. AWS, Google Cloud, Azure, or your own infrastructure.',
      benefits: ['Full source code', 'Zero vendor lock-in', 'Complete sovereignty'],
      image: 'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg',
      imagePosition: 'right' as const,
    },
    {
      title: 'Launch in Days',
      description:
        'What costs $50K+ with agencies, IDEM delivers for free. MVP to revenue in days.',
      benefits: ['Zero licensing fees', 'No subscriptions', 'Start earning fast'],
      image: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg',
      imagePosition: 'left' as const,
    },
  ];
}
