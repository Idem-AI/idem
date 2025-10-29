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
      title: 'Apache 2.0 License',
      description:
        'Full transparency with auditable source code. Deploy on your own infrastructure with complete control.',
      benefits: ['Inspect every line of code', 'No vendor lock-in', 'Community-driven development'],
    },
    {
      icon: 'pi-shield',
      title: 'Digital Sovereignty',
      description:
        'Your data stays under your control. Deploy on-premise or on African cloud infrastructure.',
      benefits: [
        'Data never leaves your control',
        'Compliance with local regulations',
        'African infrastructure options',
      ],
    },
    {
      icon: 'pi-users',
      title: 'Community Powered',
      description:
        'Built by Africans for Africa. Contribute, customize, and extend the platform for your needs.',
      benefits: [
        'African developer community',
        'Custom extensions support',
        'Continuous improvements',
      ],
    },
    {
      icon: 'pi-dollar',
      title: 'Cost Optimization',
      description:
        '60-80% cost reduction vs proprietary solutions. No licensing fees, only infrastructure costs.',
      benefits: ['No hidden fees', 'Transparent pricing', 'Community optimizations'],
    },
  ];
}
