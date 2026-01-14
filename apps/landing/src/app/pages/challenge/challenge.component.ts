import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroSectionComponent } from './components/hero-section.component';
import { MissionSectionComponent } from './components/mission-section.component';
import { StepsSectionComponent } from './components/steps-section.component';
import { PrizeSectionComponent } from './components/prize-section.component';
import { CriteriaSectionComponent } from './components/criteria-section.component';
import { CtaSectionComponent } from './components/cta-section.component';

@Component({
  selector: 'app-challenge',
  standalone: true,
  imports: [
    CommonModule,
    HeroSectionComponent,
    MissionSectionComponent,
    StepsSectionComponent,
    PrizeSectionComponent,
    CriteriaSectionComponent,
    CtaSectionComponent
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
