/**
 * Addon visx + d3 : la librairie de composants React de data-visualisation d'Airbnb (formes,
 * échelles, groupes, dégradés, motifs, courbes, textes, hiérarchies, cartes de chaleur,
 * glyphes, marqueurs, projections, grilles, axes) et les modules d3 purs qui la complètent
 * (interpolations, Voronoï, géographie + le monde en topojson pour les cartes).
 *
 * Tout est rendu en SVG par React, sans animation propre : la scène pose ses valeurs en
 * fonction du temps, image par image.
 */
import * as axis from '@visx/axis';
import * as curve from '@visx/curve';
import * as visxGeo from '@visx/geo';
import * as glyph from '@visx/glyph';
import * as gradient from '@visx/gradient';
import * as grid from '@visx/grid';
import * as group from '@visx/group';
import * as heatmap from '@visx/heatmap';
import * as hierarchy from '@visx/hierarchy';
import * as marker from '@visx/marker';
import * as pattern from '@visx/pattern';
import * as scale from '@visx/scale';
import * as shape from '@visx/shape';
import * as text from '@visx/text';
import { Delaunay } from 'd3-delaunay';
import * as d3geo from 'd3-geo';
import * as interpolate from 'd3-interpolate';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { registerAddon } from '../shared';

let countries: any = null;

registerAddon('viz', {
  axis,
  curve,
  geo: visxGeo,
  glyph,
  gradient,
  grid,
  group,
  heatmap,
  hierarchy,
  marker,
  pattern,
  scale,
  shape,
  text,
  d3: { interpolate, Delaunay, geo: d3geo },
  /** Les pays du monde (Natural Earth 1:110m), en GeoJSON, décodés une fois. */
  countries: () => (countries ??= feature(world as any, (world as any).objects.countries)),
});
