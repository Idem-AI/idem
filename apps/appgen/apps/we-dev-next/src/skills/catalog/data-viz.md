---
name: data-viz
description: Charts and stat displays that read as one system with the interface - chart choice, palette derivation, axes, and the decorations to leave out.
tier: contextual
priority: 35
triggers: [chart, graph, visualization, visualisation, analytics, metrics, statistics, kpi, plot, data viz, reporting, trends]
---

# Data visualisation

## Pick by question, not by variety

- **Trend over time** → line. Area only when the total under the curve is meaningful.
- **Comparing categories** → horizontal bars, sorted by value. Sorted alphabetically only when the reader needs to look up a specific one.
- **Part of a whole** → stacked bar. A pie chart works for two or three slices and is unreadable past that. Never a donut with eight segments.
- **Relationship** → scatter.
- **A single number** → just the number, large, with its comparison ("↑ 12% vs last month"). Not a gauge, not a radial progress ring.

Do not vary chart types for visual interest. A dashboard of six different chart types reads as decoration.

## Colour

Derive the categorical palette from the forged brand hue by rotating in even steps and holding lightness and chroma constant, so every series sits at the same visual weight. Do not use Tailwind's default colour names: they clash with a forged palette.

- Sequential data: one hue, varying lightness.
- Diverging data: two hues meeting at a neutral midpoint.
- Six categories maximum. Past that, group the tail into "Other".
- Never encode by colour alone: line charts get distinguishable markers or labels at the line ends.

Every series colour must reach 3:1 against the chart background.

## Axes and labels

- Bar charts start at zero. Always. Truncating the axis misrepresents the data.
- Label the axes with units. `Revenue (XAF)`, not `Revenue`.
- Format large numbers: `1,2 M FCFA`, not `1200000`.
- Gridlines are hairlines in `neutral-200`, horizontal only, behind the data.
- Direct-label the series where there is room; a legend is a lookup cost.

## Leave out

3D, drop shadows on bars, gradient fills under lines, animated axis entrances, background images. Every one costs legibility and buys nothing.

## States

A chart has the same four states as any async surface: loading skeleton at the chart's real dimensions, an empty state saying what data would appear here, an error with a retry, and populated. A chart that renders empty axes with no explanation reads as broken.

Charts need a text alternative: a `<table>` behind a disclosure, or an `aria-label` summarising the trend.

## Library

`recharts` for React dashboards. Responsive container, `tabular-nums` on every value in tooltips and legends.
