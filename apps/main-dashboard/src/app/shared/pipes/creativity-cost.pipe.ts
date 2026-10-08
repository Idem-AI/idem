import { Pipe, PipeTransform } from '@angular/core';
import { CreativityLevel, creativityCost } from '@idem/shared-models';

/**
 * Le prix d'une génération au cran choisi : `{{ baseCost() | creativityCost: creativity() }}`.
 * Même règle que l'API (`@idem/shared-models`) ; `null` quand le prix de base est inconnu.
 */
@Pipe({ name: 'creativityCost' })
export class CreativityCostPipe implements PipeTransform {
  transform(base: number | null | undefined, level: CreativityLevel): number | null {
    return base == null ? null : creativityCost(base, level);
  }
}
