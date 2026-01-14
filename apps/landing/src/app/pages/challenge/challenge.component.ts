import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CriteriaSectionComponent } from './components/criteria-section.component';
import { CtaSection } from './components/cta-section/cta-section';
import { HeroSection } from './components/hero-section/hero-section';
import { MissionSection } from './components/mission-section/mission-section';
import { PrizeSection } from './components/prize-section/prize-section';
import { StepsSection } from './components/steps-section/steps-section';

@Component({
  selector: 'app-challenge',
  standalone: true,
  imports: [
    CommonModule,
    HeroSection,
    MissionSection,
    StepsSection,
    PrizeSection,
    CriteriaSectionComponent,
    CtaSection
  ],
  template: `
    <div class="challenge-page">
      <app-hero-section></app-hero-section>
      <app-mission-section></app-mission-section>
      <app-steps-section></app-steps-section>
      <app-prize-section></app-prize-section>
      <app-criteria-section></app-criteria-section>
      <app-cta-section></app-cta-section>
    </div>
  `
})
export class ChallengePage {}
