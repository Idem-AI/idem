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
      title: $localize`:@@open-source-sovereignty.features.suite.title:Complete Business Suite`,
      description: $localize`:@@open-source-sovereignty.features.suite.description:200+ AI agents build your brand, strategy, and product from a single idea.`,
      benefits: [
        $localize`:@@open-source-sovereignty.features.suite.benefit1:Logo & brand identity`,
        $localize`:@@open-source-sovereignty.features.suite.benefit2:Business plans`,
        $localize`:@@open-source-sovereignty.features.suite.benefit3:Full-stack web apps`,
      ],
      image: '/assets/images/open-source-sovereignty-component/business-suite.jpeg',
      imagePosition: 'left' as const,
    },
    {
      title: $localize`:@@open-source-sovereignty.features.deploy.title:Deploy Anywhere`,
      description: $localize`:@@open-source-sovereignty.features.deploy.description:Your code, your servers, your data. AWS, Google Cloud, Azure, or your own infrastructure.`,
      benefits: [
        $localize`:@@open-source-sovereignty.features.deploy.benefit1:Full source code`,
        $localize`:@@open-source-sovereignty.features.deploy.benefit2:Zero vendor lock-in`,
        $localize`:@@open-source-sovereignty.features.deploy.benefit3:Complete sovereignty`,
      ],
      image: '/assets/images/open-source-sovereignty-component/deploy-anywhere.jpeg',
      imagePosition: 'right' as const,
    },
    {
      title: $localize`:@@open-source-sovereignty.features.launch.title:Launch in Days`,
      description: $localize`:@@open-source-sovereignty.features.launch.description:What costs $50K+ with agencies, IDEM delivers for free. MVP to revenue in days.`,
      benefits: [
        $localize`:@@open-source-sovereignty.features.launch.benefit1:Zero licensing fees`,
        $localize`:@@open-source-sovereignty.features.launch.benefit2:No subscriptions`,
        $localize`:@@open-source-sovereignty.features.launch.benefit3:Start earning fast`,
      ],
      image: '/assets/images/open-source-sovereignty-component/launch-in-days.jpeg',
      imagePosition: 'left' as const,
    },
  ];
}
