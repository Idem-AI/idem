// @example clip
// @tags video, clip, footage, filmed, b-roll, overlay, cinematic
// @shows Un clip vidéo plein cadre (Video + play), un voile pour lire le texte, un titre qui entre par le bas.
import { Rect, Txt, Video, View2D } from '@motion-canvas/2d';
import { all, createRef, easeOutCubic, waitFor } from '@motion-canvas/core';
import { alpha, fitMedia, safeArea, SceneContext } from '@idem/motion';

export default function* (view: View2D, ctx: SceneContext) {
  const area = safeArea(ctx);
  const clip = ctx.media.find((m) => m.kind === 'video');
  const fit = clip ? fitMedia(clip, ctx.width, ctx.height) : { width: ctx.width, height: ctx.height };
  const video = createRef<Video>();
  const title = createRef<Txt>();

  view.add(
    <>
      {clip && <Video ref={video} src={clip.url} width={fit.width} height={fit.height} />}
      <Rect width={ctx.width} height={ctx.height * 0.45} y={ctx.height * 0.275} fill={alpha('#000000', 0.45)} />
      <Txt ref={title} text={ctx.texts.headline || ''} width={area.width} textWrap x={0} y={area.bottom - ctx.unit * 12} fontFamily={ctx.brand.fonts.display} fontWeight={800} fontSize={ctx.unit * 8} fill={'#ffffff'} opacity={0} />
    </>
  );

  video()?.play();
  yield* all(title().opacity(1, 0.5), title().y(area.bottom - ctx.unit * 16, 0.7, easeOutCubic));
  yield* waitFor(ctx.duration);
}
