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
      title: $localize`:@@open-source-sovereignty.features.creation.title:Everything to Launch Your Business`,
      description: $localize`:@@open-source-sovereignty.features.creation.description:IDEM generates your complete business package: professional logo, brand identity, business plan, legal documents, and a full-stack web application. Everything you need to start your entrepreneurial journey.`,
      benefits: [
        $localize`:@@open-source-sovereignty.features.creation.benefit1:Logo & brand identity`,
        $localize`:@@open-source-sovereignty.features.creation.benefit2:Business plan & legal documents`,
        $localize`:@@open-source-sovereignty.features.creation.benefit3:Full-stack web application`,
      ],
      image: '/assets/images/open-source-sovereignty-component/business-suite.webp',
      imagePosition: 'left' as const,
    },
    {
      title: $localize`:@@open-source-sovereignty.features.deployment.title:Deploy Your App Instantly`,
      description: $localize`:@@open-source-sovereignty.features.deployment.description:IDEM doesn't just build your app—it deploys it too. Automatic deployment to the cloud with your own domain. Your business goes live in minutes, not weeks.`,
      benefits: [
        $localize`:@@open-source-sovereignty.features.deployment.benefit1:Automatic cloud deployment`,
        $localize`:@@open-source-sovereignty.features.deployment.benefit2:Custom domain included`,
        $localize`:@@open-source-sovereignty.features.deployment.benefit3:Live in minutes`,
      ],
      image: '/assets/images/open-source-sovereignty-component/deploy-anywhere.webp',
      imagePosition: 'right' as const,
    },
    {
      title: $localize`:@@open-source-sovereignty.features.opensource.title:Open Source & Made in Africa`,
      description: $localize`:@@open-source-sovereignty.features.opensource.description:IDEM is open source and built in Cameroon for young African entrepreneurs. You own your code, control your data, and can customize everything. No technical skills required to start.`,
      benefits: [
        $localize`:@@open-source-sovereignty.features.opensource.benefit1:Open source platform`,
        $localize`:@@open-source-sovereignty.features.opensource.benefit2:Built in Cameroon for Africa`,
        $localize`:@@open-source-sovereignty.features.opensource.benefit3:No coding skills needed`,
      ],
      image: '/assets/images/open-source-sovereignty-component/launch-in-days.webp',
      imagePosition: 'left' as const,
    },
  ];
}
