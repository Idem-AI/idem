import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroSection } from './components/hero-section/hero-section';
import { MissionSection } from './components/mission-section/mission-section';
import { StepsSection } from './components/steps-section/steps-section';
import { PrizeSection } from './components/prize-section/prize-section';
import { CriteriaSection } from './components/criteria-section/criteria-section';
import { CtaSection } from './components/cta-section/cta-section';

@Component({
  selector: 'app-challenge',
  standalone: true,
  imports: [
    CommonModule,
    HeroSection,
    MissionSection,
    StepsSection,
    PrizeSection,
    CriteriaSection,
    CtaSection
  ],
  templateUrl: './challenge.html',
  styleUrls: ['./challenge.css']
})
export class ChallengeComponent {

}
