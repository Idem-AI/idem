// @example photo
// @tags image, photo, media, product, picture, ken burns, mask, cover, crop
// @shows Une photo qui couvre un cadre arrondi (fitMedia + clip), un lent travelling avant, un cadre qui s'ouvre (masque), une légende.
import { Img, Rect, Txt, View2D } from '@motion-canvas/2d';
import { all, createRef, easeInOutCubic, easeOutExpo, linear, waitFor } from '@motion-canvas/core';
import { fitMedia, readableOn, safeArea, SceneContext } from '@idem/motion';

export default function* (view: View2D, ctx: SceneContext) {
  const area = safeArea(ctx);
  const photo = ctx.media.find((m) => m.kind === 'image');
  const frameW = area.width;
  const frameH = Math.min(area.height * 0.62, frameW * 1.25);
  const frame = createRef<Rect>();
  const img = createRef<Img>();
  const caption = createRef<Txt>();
  const fit = photo ? fitMedia(photo, frameW, frameH) : { width: frameW, height: frameH };

  view.add(
    <>
      <Rect ref={frame} width={frameW} height={0} y={-ctx.unit * 8} radius={ctx.unit * 3} clip fill={ctx.brand.colors.secondary}>
        {photo && <Img ref={img} src={photo.url} width={fit.width * 1.12} height={fit.height * 1.12} />}
      </Rect>
      <Txt ref={caption} text={ctx.texts.caption || ''} y={-ctx.unit * 8 + frameH / 2 + ctx.unit * 9} width={frameW} textWrap textAlign={'left'} fontFamily={ctx.brand.fonts.display} fontWeight={700} fontSize={ctx.unit * 6} fill={readableOn(ctx.brand.colors.background, ctx.brand.colors.text)} opacity={0} />
    </>
  );

  // Le cadre s'ouvre, la photo se resserre lentement pendant toute la scène.
  // La photo est 12 % plus grande que le cadre : elle se resserre jusqu'à le couvrir exactement.
  if (img()) yield img().scale(1 / 1.12, ctx.duration, linear);
  yield* frame().height(frameH, 0.8, easeOutExpo);
  yield* all(caption().opacity(1, 0.5), caption().y(caption().y() - ctx.unit * 2, 0.5, easeInOutCubic));
  yield* waitFor(ctx.duration);
}
