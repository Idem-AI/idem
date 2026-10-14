// @example typography
// @tags text, words, title, headline, kinetic, typography, stagger, reveal
// @shows Mesurer un titre pour qu'il tienne (fitFontSize), empiler titre, trait et sous-titre dans une colonne flexible (Layout : un texte plus long pousse le reste au lieu de le chevaucher), révéler les mots un par un (sequence), un trait qui se dessine (Line.end).
import { Layout, Line, Txt, View2D } from '@motion-canvas/2d';
import { all, createRef, easeOutCubic, sequence, waitFor } from '@motion-canvas/core';
import { fitFontSize, readableOn, safeArea, SceneContext, words } from '@idem/motion';

export default function* (view: View2D, ctx: SceneContext) {
  const area = safeArea(ctx);
  const ink = readableOn(ctx.brand.colors.background, ctx.brand.colors.text);
  const title = ctx.texts.headline || '';
  const size = fitFontSize(title, { maxWidth: area.width, max: ctx.unit * 14, lines: 3, fontFamily: ctx.brand.fonts.display, fontWeight: 800 });

  const rule = createRef<Line>();
  const sub = createRef<Txt>();
  const parts = words(title);
  const refs = parts.map(() => createRef<Txt>());

  view.add(
    // Une colonne : chaque élément se place sous le précédent, quelle que soit la longueur des textes.
    <Layout layout direction={'column'} alignItems={'start'} gap={ctx.unit * 3} width={area.width}>
      <Layout layout wrap={'wrap'} columnGap={size * 0.25} width={area.width}>
        {parts.map((w, i) => (
          <Txt ref={refs[i]} text={w} fontFamily={ctx.brand.fonts.display} fontWeight={800} fontSize={size} lineHeight={size * 1.05} fill={ink} opacity={0} />
        ))}
      </Layout>
      <Line ref={rule} points={[[0, 0], [area.width * 0.4, 0]]} stroke={ctx.brand.colors.accent} lineWidth={ctx.unit * 1.2} lineCap={'round'} end={0} />
      <Txt ref={sub} text={ctx.texts.sub || ''} width={area.width} textWrap fontFamily={ctx.brand.fonts.body} fontSize={ctx.unit * 4.4} fill={ink} opacity={0} />
    </Layout>
  );

  // Chaque mot apparaît et se pose, 0,08 s après le précédent (dans une colonne, on anime l'opacité et l'échelle, pas la position).
  for (const r of refs) r().scale(0.92);
  yield* sequence(0.08, ...refs.map((r) => all(r().opacity(1, 0.45), r().scale(1, 0.55, easeOutCubic))));
  ctx.sfx('softwhoosh');
  yield* all(rule().end(1, 0.6, easeOutCubic), sub().opacity(1, 0.6));
  yield* waitFor(ctx.duration);
}
