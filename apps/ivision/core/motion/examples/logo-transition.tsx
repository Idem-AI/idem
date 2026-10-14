// @example logo-transition
// @tags logo, brand, signature, end card, outro, transition, wipe, slide, call to action, cta
// @shows Entrer par une transition de Motion Canvas (slideTransition), dévoiler le logo (Img du logo de la marque), un appel à l'action qui pulse (loop).
import { Img, Rect, Txt, View2D } from '@motion-canvas/2d';
import { all, createRef, Direction, easeInOutSine, easeOutCubic, loop, slideTransition, waitFor } from '@motion-canvas/core';
import { readableOn, SceneContext } from '@idem/motion';

export default function* (view: View2D, ctx: SceneContext) {
  const { colors, fonts, logo, name } = ctx.brand;
  view.fill(colors.primary);
  const ink = readableOn(colors.primary);
  const mark = createRef<Img>();
  const brandName = createRef<Txt>();
  const cta = createRef<Rect>();
  const logoSrc = ink === '#ffffff' ? logo?.dark || logo?.light : logo?.light;
  const logoW = ctx.unit * 46;
  const logoH = logo?.width && logo?.height ? (logoW * logo.height) / logo.width : logoW * 0.4;

  view.add(
    <>
      {logoSrc ? <Img ref={mark} src={logoSrc} width={logoW} height={logoH} y={-ctx.unit * 8} opacity={0} scale={0.9} /> : <Txt ref={brandName} text={name} fontFamily={fonts.display} fontWeight={800} fontSize={ctx.unit * 10} fill={ink} y={-ctx.unit * 8} opacity={0} />}
      <Rect ref={cta} y={ctx.unit * 14} padding={[ctx.unit * 2.4, ctx.unit * 5]} radius={ctx.unit * 6} fill={colors.accent} layout opacity={0}>
        <Txt text={ctx.texts.cta || ''} fill={readableOn(colors.accent)} fontFamily={fonts.body} fontWeight={700} fontSize={ctx.unit * 4.6} />
      </Rect>
    </>
  );

  // La scène précédente glisse vers la gauche : c'est l'entrée de celle-ci.
  yield* slideTransition(Direction.Right, 0.6);
  const brand = mark() || brandName();
  ctx.sfx('shimmer');
  yield* all(brand.opacity(1, 0.6), brand.scale(1, 0.8, easeOutCubic));
  yield* cta().opacity(1, 0.4);
  yield loop(() => cta().scale(1.06, 0.5, easeInOutSine).to(1, 0.5, easeInOutSine));
  yield* waitFor(ctx.duration);
}
