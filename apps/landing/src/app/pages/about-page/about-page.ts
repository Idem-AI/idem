import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Team } from '../../components/team/team';

interface Value {
  title: string;
  description: string;
  icon: string;
}

interface Milestone {
  year: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule, RouterLink, Team],
  templateUrl: './about-page.html',
  styleUrl: './about-page.css',
})
export class AboutPage {

  protected readonly values: Value[] = [
    {
      title: $localize`:@@about-page.values.sovereignty.title:Souveraineté Africaine`,
      description: $localize`:@@about-page.values.sovereignty.description:Chaque choix sert la souveraineté numérique du continent.`,
      icon: 'sovereignty',
    },
    {
      title: $localize`:@@about-page.values.discipline.title:Discipline`,
      description: $localize`:@@about-page.values.discipline.description:Rigueur d'exécution et excellence technique, sans compromis.`,
      icon: 'discipline',
    },
    {
      title: $localize`:@@about-page.values.passion.title:Passion`,
      description: $localize`:@@about-page.values.passion.description:Un engagement total pour l'entrepreneuriat africain.`,
      icon: 'passion',
    },
    {
      title: $localize`:@@about-page.values.patience.title:Patience`,
      description: $localize`:@@about-page.values.patience.description:On construit solide, sur le long terme.`,
      icon: 'patience',
    },
    {
      title: $localize`:@@about-page.values.perseverance.title:Persévérance`,
      description: $localize`:@@about-page.values.perseverance.description:On n'abandonne pas, malgré les obstacles.`,
      icon: 'perseverance',
    },
  ];

  protected readonly milestones: Milestone[] = [
    {
      year: '2025',
      title: $localize`:@@about-page.milestones.foundation.title:Foundation`,
      description: $localize`:@@about-page.milestones.foundation.description:IDEM founded in Cameroon with a vision to democratize AI for African entrepreneurs`,
    },
    {
      year: '2027',
      title: $localize`:@@about-page.milestones.mvp.title:MVP Launch`,
      description: $localize`:@@about-page.milestones.mvp.description:First version released with core features: logo generation, business plans, and website builder`,
    },
    {
      year: '2028',
      title: $localize`:@@about-page.milestones.openSource.title:Open Source`,
      description: $localize`:@@about-page.milestones.openSource.description:Full codebase released under Apache 2.0 license, becoming Africa's first sovereign AI platform`,
    },
    {
      year: '2029',
      title: $localize`:@@about-page.milestones.expansion.title:Pan-African Expansion`,
      description: $localize`:@@about-page.milestones.expansion.description:Expanding infrastructure across Africa with local data centers and partnerships`,
    },
  ];

  protected readonly stats = [
    { value: '2025', label: $localize`:@@about-page.stats.founded:Founded` },
    { value: '1000+', label: $localize`:@@about-page.stats.projects:Projects Created` },
    { value: '15+', label: $localize`:@@about-page.stats.countries:African Countries` },
    { value: '100%', label: $localize`:@@about-page.stats.openSource:Open Source` },
  ];

}
