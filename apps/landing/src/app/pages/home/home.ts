import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// Import components
import { Hero } from '../../components/hero/hero';
import { VideoTrailer } from '../../components/video-trailer/video-trailer';
import { JourneyComponent } from '../../components/journey/journey';
import { OfferEcosystemComponent } from '../../components/offer-ecosystem/offer-ecosystem';
import { TechnologySovereigntyComponent } from '../../components/technology-sovereignty/technology-sovereignty';
import { Cta } from '../../components/cta/cta';
import { BetaProgram } from '../../components/beta-program/beta-program';

/**
 * L'accueil. Son référencement (titre, partage, JSON-LD) est posé par
 * `SeoService` d'après la route (`data.seo: 'home'`).
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    Hero,
    VideoTrailer,
    JourneyComponent,
    OfferEcosystemComponent,
    TechnologySovereigntyComponent,
    Cta,
    BetaProgram,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {}
