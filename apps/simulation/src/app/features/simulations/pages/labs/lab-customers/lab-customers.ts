import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LabPanel } from '../../../components/lab-panel/lab-panel';
import { SimulationStore } from '../../../data-access';

const WIDTH = 640;
const HEIGHT = 200;

/**
 * Un panel de clients synthétiques : segments, et ce que chaque prix ferait
 * au taux de conversion. La courbe est la sortie utile, pas le panel.
 */
@Component({
  selector: 'sim-lab-customers',
  imports: [TranslatePipe, LabPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lab-customers.html',
})
export class LabCustomers {
  private readonly store = inject(SimulationStore);

  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;
  protected readonly report = computed(() => this.store.labs().customers ?? null);

  /** Points de la courbe revenu/prix, normalisés dans le repère du SVG. */
  protected readonly curve = computed(() => {
    const points = this.report()?.pricePoints ?? [];
    if (points.length < 2) {
      return null;
    }
    const prices = points.map((point) => point.price);
    const revenues = points.map((point) => point.estimatedRevenue);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const maxRevenue = Math.max(...revenues, 1);
    const x = (price: number) =>
      maxPrice === minPrice ? WIDTH / 2 : ((price - minPrice) / (maxPrice - minPrice)) * WIDTH;
    const y = (revenue: number) => HEIGHT - (revenue / maxRevenue) * (HEIGHT - 16) - 8;

    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.price).toFixed(1)} ${y(point.estimatedRevenue).toFixed(1)}`)
      .join(' ');

    const best = points.reduce((a, b) => (b.estimatedRevenue > a.estimatedRevenue ? b : a));

    return {
      path,
      dots: points.map((point) => ({
        cx: x(point.price),
        cy: y(point.estimatedRevenue),
        point,
        best: point.price === best.price,
      })),
      minPrice,
      maxPrice,
    };
  });
}
