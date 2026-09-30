import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SimulationCta } from './components/simulation-cta/simulation-cta';
import { SimulationEntry } from './components/simulation-entry/simulation-entry';
import { SimulationEvidence } from './components/simulation-evidence/simulation-evidence';
import { SimulationFactorWall } from './components/simulation-factor-wall/simulation-factor-wall';
import { SimulationHero } from './components/simulation-hero/simulation-hero';
import { SimulationHonesty } from './components/simulation-honesty/simulation-honesty';
import { SimulationLoop } from './components/simulation-loop/simulation-loop';
import { SimulationPipeline } from './components/simulation-pipeline/simulation-pipeline';
import { SimulationReadout } from './components/simulation-readout/simulation-readout';
import { SimulationReport } from './components/simulation-report/simulation-report';
import { SimulationSectors } from './components/simulation-sectors/simulation-sectors';
import { SimulationStressTests } from './components/simulation-stress-tests/simulation-stress-tests';

/**
 * Shell of the IDEM Simulator page. It owns the ambient backdrop, the SEO tags
 * and the structured data; every section of the argument is its own component
 * under `./components`.
 */
@Component({
  selector: 'app-simulation-page',
  standalone: true,
  imports: [
    SimulationHero,
    SimulationFactorWall,
    SimulationPipeline,
    SimulationSectors,
    SimulationStressTests,
    SimulationReadout,
    SimulationEvidence,
    SimulationReport,
    SimulationLoop,
    SimulationEntry,
    SimulationHonesty,
    SimulationCta,
  ],
  templateUrl: './simulation-page.html',
  styleUrl: './simulation-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** Référencement (dont la FAQ en JSON-LD) : `SeoService`, d'après la route. */
export class SimulationPage {}
