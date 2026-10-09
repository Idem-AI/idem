/**
 * Addon Chart.js 4 : graphiques classiques (barres, lignes, anneaux, radar, aires polaires,
 * bulles) et avancés (treemap, sankey, matrice), étiquettes et repères.
 *
 * Usage vidéo : AUCUNE animation propre. `animation:false`, `responsive:false`, aucun
 * événement : le kit (`kit/Chart.tsx`) pose les valeurs de l'instant puis `update('none')`,
 * qui dessine de façon synchrone. La même image, quel que soit l'ordre de lecture.
 */
import { Chart, registerables } from 'chart.js';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import { Flow, SankeyController } from 'chartjs-chart-sankey';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';
import annotationPlugin from 'chartjs-plugin-annotation';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { registerAddon } from '../shared';

Chart.register(...registerables, TreemapController, TreemapElement, SankeyController, Flow, MatrixController, MatrixElement, annotationPlugin, ChartDataLabels);

Chart.defaults.animation = false;
Chart.defaults.responsive = false;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.events = [];
Chart.defaults.plugins.tooltip.enabled = false;
Chart.defaults.plugins.legend.display = false;
// Les étiquettes ne s'affichent que là où le kit (ou la scène) les demande.
(Chart.defaults.plugins as any).datalabels = { ...(Chart.defaults.plugins as any).datalabels, display: false };

registerAddon('chart', { Chart });
