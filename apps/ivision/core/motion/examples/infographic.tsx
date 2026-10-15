// @example infographic
// @tags data, chart, number, figure, stat, bars, infographic, counter, percent
// @shows Un compteur qui défile (createSignal + texte calculé), des barres qui poussent l'une après l'autre, des étiquettes.
import { Rect, Txt, View2D } from '@motion-canvas/2d';
import { all, createRef, createSignal, easeOutCubic, sequence, waitFor } from '@motion-canvas/core';
import { readableOn, safeArea, SceneContext } from '@idem/motion';

export default function* (view: View2D, ctx: SceneContext) {
  const area = safeArea(ctx);
  const ink = readableOn(ctx.brand.colors.background, ctx.brand.colors.text);
  // Le chiffre vient du texte (« 1 250 clients ») : on anime sa partie numérique.
  const figure = ctx.texts.figure || '0';
  const parts = figure.match(/^([\d\s.,]*\d)(.*)$/);
  const target = Number((parts?.[1] || '0').replace(/[^\d.]/g, '')) || 0;
  const suffix = parts?.[2] ?? '';
  const count = createSignal(0);
  const values = [0.45, 0.7, 1];
  const bars = values.map(() => createRef<Rect>());
  const barW = area.width / 5;

  view.add(
    <>
      <Txt text={() => `${Math.round(count()).toLocaleString('fr-FR')}${suffix}`} y={area.top + ctx.unit * 20} fontFamily={ctx.brand.fonts.display} fontWeight={800} fontSize={ctx.unit * 16} fill={ctx.brand.colors.primary} />
      <Txt text={ctx.texts.label || ''} y={area.top + ctx.unit * 34} fontFamily={ctx.brand.fonts.body} fontSize={ctx.unit * 4.6} fill={ink} />
      {values.map((v, i) => (
        // offsetY={1} : la barre pousse depuis sa base.
        <Rect ref={bars[i]} x={(i - 1) * barW * 1.4} y={area.bottom - ctx.unit * 6} offsetY={1} width={barW} height={0} radius={[ctx.unit, ctx.unit, 0, 0]} fill={i === values.length - 1 ? ctx.brand.colors.accent : ctx.brand.colors.secondary} />
      ))}
    </>
  );

  yield* all(
    count(target, 1.4, easeOutCubic),
    sequence(0.15, ...bars.map((b, i) => b().height(area.height * 0.38 * values[i], 0.8, easeOutCubic)))
  );
  ctx.sfx('pop');
  yield* waitFor(ctx.duration);
}
