import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

interface Founder {
  name: string;
  role: string;
  bio: string;
  photo: string;
}

@Component({
  selector: 'app-team',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  templateUrl: './team.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './team.css'],
})
export class Team {
  protected readonly founders: Founder[] = [
    {
      name: 'Arolle Aguekeng',
      role: $localize`:@@team.arolle.role:CEO, co-founder`,
      bio: $localize`:@@team.arolle.bio:Senior software engineer. She decides what IDEM builds and what it refuses to build, and she knows the African entrepreneurial ecosystem from the inside.`,
      photo: 'assets/images/team/arolle.webp',
    },
    {
      name: 'Romuald Djeteje',
      role: $localize`:@@team.romuald.role:CTO, co-founder`,
      bio: $localize`:@@team.romuald.bio:DevSecOps engineer. He owns the infrastructure, the security of the platform and everything that has to keep running when traffic grows.`,
      photo: 'assets/images/team/romuald.webp',
    },
  ];
}
