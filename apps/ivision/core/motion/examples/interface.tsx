// @example interface
// @tags app, interface, screen, phone, mobile, ui, website, dashboard, demo, tap, cursor
// @shows Un téléphone dessiné (Rect arrondis), des cartes d'interface qui glissent, un doigt qui touche un bouton (pulsation), une capture d'écran si la scène en a une.
import { Circle, Img, Rect, Txt, View2D } from '@motion-canvas/2d';
import { all, chain, createRef, easeInOutCubic, easeOutBack, easeOutCubic, sequence, waitFor } from '@motion-canvas/core';
import { fitMedia, mix, readableOn, SceneContext } from '@idem/motion';

export default function* (view: View2D, ctx: SceneContext) {
  const { colors, fonts } = ctx.brand;
  const phoneH = Math.min(ctx.height * 0.7, ctx.width * 1.35);
  const phoneW = phoneH * 0.49;
  const screen = ctx.media.find((m) => m.kind === 'image');
  const phone = createRef<Rect>();
  const cards = [0, 1, 2].map(() => createRef<Rect>());
  const button = createRef<Rect>();
  const finger = createRef<Circle>();
  const fit = screen ? fitMedia(screen, phoneW - ctx.unit * 2, phoneH - ctx.unit * 2) : null;

  view.add(
    <Rect ref={phone} width={phoneW} height={phoneH} radius={phoneW * 0.14} fill={'#121417'} padding={ctx.unit} y={ctx.height} shadowColor={'rgba(0,0,0,0.25)'} shadowBlur={ctx.unit * 6} shadowOffsetY={ctx.unit * 2}>
      <Rect width={phoneW - ctx.unit * 2} height={phoneH - ctx.unit * 2} radius={phoneW * 0.11} clip fill={colors.background}>
        {screen && fit ? (
          <Img src={screen.url} width={fit.width} height={fit.height} />
        ) : (
          <>
            {cards.map((c, i) => (
              <Rect ref={c} y={-phoneH * 0.22 + i * phoneH * 0.17} x={phoneW} width={phoneW * 0.8} height={phoneH * 0.13} radius={ctx.unit * 1.6} fill={mix(colors.background, colors.primary, 0.08 + i * 0.05)} />
            ))}
            <Rect ref={button} y={phoneH * 0.33} width={phoneW * 0.7} height={phoneH * 0.08} radius={phoneH * 0.04} fill={colors.primary} scale={0}>
              <Txt text={ctx.texts.button || 'OK'} fill={readableOn(colors.primary)} fontFamily={fonts.body} fontWeight={700} fontSize={phoneH * 0.028} />
            </Rect>
          </>
        )}
      </Rect>
      <Circle ref={finger} size={ctx.unit * 7} fill={'rgba(255,255,255,0.55)'} stroke={'#ffffff'} lineWidth={ctx.unit * 0.5} position={[phoneW * 0.5, phoneH * 0.5]} opacity={0} />
    </Rect>
  );

  yield* phone().y(0, 0.9, easeOutCubic);
  yield* sequence(0.12, ...cards.map((c) => (c() ? c().x(0, 0.5, easeOutCubic) : waitFor(0))));
  if (button()) yield* button().scale(1, 0.45, easeOutBack);
  // Le doigt vient toucher le bouton : une pulsation, un clic.
  yield* all(finger().opacity(1, 0.3), finger().position([0, phoneH * 0.33], 0.6, easeInOutCubic));
  ctx.sfx('click');
  yield* chain(finger().scale(0.8, 0.12), finger().scale(1, 0.18));
  yield* waitFor(ctx.duration);
}
