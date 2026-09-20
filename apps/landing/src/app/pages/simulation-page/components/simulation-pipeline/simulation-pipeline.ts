import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

interface PipelineStep {
  id: string;
  title: string;
  body: string;
}

/**
 * What actually happens when a simulation starts: five stages, not a chat with
 * an AI.
 */
@Component({
  selector: 'app-simulation-pipeline',
  standalone: true,
  imports: [NgOptimizedImage],
  templateUrl: './simulation-pipeline.html',
  styleUrl: './simulation-pipeline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationPipeline {
  protected readonly pipeline: PipelineStep[] = [
    {
      id: 'read',
      title: $localize`:@@simulation.pipeline.read.title:Reading the project`,
      body: $localize`:@@simulation.pipeline.read.body:IDEM builds a structured picture of your project, separating what it knows from what it has to research, what stays uncertain, and what is missing.`,
    },
    {
      id: 'discover',
      title: $localize`:@@simulation.pipeline.discover.title:Factor discovery`,
      body: $localize`:@@simulation.pipeline.discover.body:Agents look for the factors that can actually move this particular business, then rank them as critical, important, secondary or uncertain.`,
    },
    {
      id: 'research',
      title: $localize`:@@simulation.pipeline.research.title:Data research`,
      body: $localize`:@@simulation.pipeline.research.body:Prices, density, costs, regulation, seasonality: every external value arrives with its source, its date and how much confidence it carries.`,
    },
    {
      id: 'simulate',
      title: $localize`:@@simulation.pipeline.simulate.title:Simulation`,
      body: $localize`:@@simulation.pipeline.simulate.body:The engine combines factors and runs baseline, favourable and adverse scenarios, stress tests, and rare compound shocks.`,
    },
    {
      id: 'analyse',
      title: $localize`:@@simulation.pipeline.analyse.title:Analysis`,
      body: $localize`:@@simulation.pipeline.analyse.body:Viability index, robustness, confidence level, breaking points, the conditions viability depends on, and recommendations ranked by priority.`,
    },
  ];
}
