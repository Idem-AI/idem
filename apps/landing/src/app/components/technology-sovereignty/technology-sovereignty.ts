import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Milestone {
  readonly when: string;
  readonly tag: string;
  readonly title: string;
  readonly description: string;
}

@Component({
  selector: 'app-technology-sovereignty',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './technology-sovereignty.html',
  styleUrl: './technology-sovereignty.css',
})
export class TechnologySovereigntyComponent {
  protected readonly squads: readonly string[] = [
    $localize`:@@tech.squad.strategy:Strategy squad`,
    $localize`:@@tech.squad.creative:Creative squad`,
    $localize`:@@tech.squad.technical:Technical squad`,
  ];

  protected readonly milestones: readonly Milestone[] = [
    {
      when: $localize`:@@tech.roadmap.now.when:Today`,
      tag: $localize`:@@tech.roadmap.now.tag:In production`,
      title: $localize`:@@tech.roadmap.now.title:Powered by Gemini, model-agnostic`,
      description: $localize`:@@tech.roadmap.now.description:Compatible with every major LLM, so no single vendor holds the keys.`,
    },
    {
      when: $localize`:@@tech.roadmap.next.when:+12 months`,
      tag: $localize`:@@tech.roadmap.next.tag:AI sovereignty`,
      title: $localize`:@@tech.roadmap.next.title:GLM-5.2 self-hosted on Huawei Ascend`,
      description: $localize`:@@tech.roadmap.next.description:A frontier model on our own hardware. Intelligence is owned, not rented.`,
    },
    {
      when: $localize`:@@tech.roadmap.later.when:2028`,
      tag: $localize`:@@tech.roadmap.later.tag:In-house models`,
      title: $localize`:@@tech.roadmap.later.title:IDEM-Text, Vision & Code`,
      description: $localize`:@@tech.roadmap.later.description:Our own models, trained on African data.`,
    },
  ];
}
