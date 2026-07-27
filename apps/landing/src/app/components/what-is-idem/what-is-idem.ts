import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface JourneyStep {
  readonly label: string;
  readonly caption: string;
  /** Single SVG path (heroicons outline). */
  readonly icon: string;
}

@Component({
  selector: 'app-what-is-idem',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './what-is-idem.html',
  styleUrl: './what-is-idem.css',
})
export class WhatIsIdemComponent {
  protected readonly badges: readonly string[] = [
    $localize`:@@what-is-idem.badge.opensource:Open source · Apache 2.0`,
    $localize`:@@what-is-idem.badge.agents:200+ AI agents`,
    $localize`:@@what-is-idem.badge.sovereign:Sovereign, hosted in Africa`,
    $localize`:@@what-is-idem.badge.human:AI + certified human advisors`,
  ];

  protected readonly steps: readonly JourneyStep[] = [
    {
      label: $localize`:@@what-is-idem.step.idea.label:Idea`,
      caption: $localize`:@@what-is-idem.step.idea.caption:Describe it in plain words`,
      icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    },
    {
      label: $localize`:@@what-is-idem.step.brand.label:Brand`,
      caption: $localize`:@@what-is-idem.step.brand.caption:Logo & identity`,
      icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
    },
    {
      label: $localize`:@@what-is-idem.step.strategy.label:Strategy`,
      caption: $localize`:@@what-is-idem.step.strategy.caption:Plan & finances`,
      icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      label: $localize`:@@what-is-idem.step.product.label:Product`,
      caption: $localize`:@@what-is-idem.step.product.caption:Full-stack app`,
      icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    },
    {
      label: $localize`:@@what-is-idem.step.deploy.label:Deploy`,
      caption: $localize`:@@what-is-idem.step.deploy.caption:Live, on African servers`,
      icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
    },
    {
      label: $localize`:@@what-is-idem.step.support.label:Support`,
      caption: $localize`:@@what-is-idem.step.support.caption:Human advisors & funding`,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    },
  ];
}
