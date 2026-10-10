import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LandingClosing } from './components/closing';
import { LandingCreativity } from './components/creativity';
import { LandingHero } from './components/hero';
import { LandingImprint } from './components/imprint';
import { LandingFooter } from './components/landing-footer';
import { LandingHeader } from './components/landing-header';
import { LandingLiveEdit } from './components/live-edit';
import { LandingMontage } from './components/montage';
import { LandingStencil } from './components/stencil';
import { LandingWorkshops } from './components/workshops';

/**
 * La page publique d'iVision. Chaque section est un composant de `components/` :
 *   hero        « Dites-le. Voyez-le. » et une vidéo qui change de format dans un viseur
 *   imprint     votre site devient votre charte (tampon adinkra)
 *   stencil     montrez un modèle, il le reproduit (pochoir d'adire)
 *   live-edit   cliquez, écrivez, c'est changé (feuillet et calame)
 *   workshops   visuels et vidéos, deux ateliers (kente, kora)
 *   creativity  le cran de créativité (échelle dogon)
 *   montage     filmez-vous, iVision monte (raphia kuba)
 *   closing     le compte IDEM suffit (calebasse de cauris)
 */
@Component({
  selector: 'iv-landing',
  imports: [
    LandingHeader,
    LandingHero,
    LandingImprint,
    LandingStencil,
    LandingLiveEdit,
    LandingWorkshops,
    LandingCreativity,
    LandingMontage,
    LandingClosing,
    LandingFooter,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.html',
})
export class Landing {}
