/**
 * LE KIT DES SCÈNES ÉCRITES PAR L'IA (cran Ultra de la jauge de créativité).
 *
 * Au cran Ultra, un agent codeur écrit le composant React d'une scène. Il n'a accès qu'à
 * ce kit — importé comme `@idem/kit` — et à React : les mêmes briques que les scènes du
 * moteur (temps, entrées, typographie ajustée, sons, icônes), donc les mêmes garanties
 * (lisibilité, déterminisme, charte). Le manifeste lu par l'agent est écrit côté serveur
 * (`video.coder.ts#KIT_MANIFEST`) : toute brique ajoutée ici doit y être décrite.
 *
 * Le code arrive compilé (esbuild, CommonJS) dans `data.customScenes`. Il est évalué ici,
 * dans la page de rendu (réseau coupé, aucune API Node) ; une scène qui ne se charge pas
 * ou qui lève une erreur retombe sur sa composition « Max » (cf. App.tsx#SceneBoundary).
 */
import * as React from 'react';
import { useEngine, useLocalTime, useScene } from './context';
import { cue } from './cues';
import { Icon } from './kit/Icon';
import { LogoMotion } from './kit/LogoMotion';
import { ANCHOR_STYLE, Composition, useCamera, useEnter, useExitAt, useFamilyKind } from './layout';
import { contentOf, LabelBlock, stackLines, useBeatPulse, useExitFactor, useSceneProgress } from './layouts';
import { ActionButton, Headline, Support, useHeadlineSound } from './scenes';
import { Kinetic, Odometer } from './text';
import { clamp, hash, keyframes, mix, progress, springEase } from './time';

export const KIT = {
  // Temps et scène
  useScene,
  useLocalTime,
  useEngine,
  useSceneProgress,
  useExitAt,
  useExitFactor,
  useBeatPulse,
  useCamera,
  contentOf,
  // Entrées et composition
  useEnter,
  useFamilyKind,
  Composition,
  ANCHOR_STYLE,
  // Typographie (ajustée à la place disponible : jamais de texte qui déborde)
  Kinetic,
  Odometer,
  Headline,
  Support,
  ActionButton,
  LabelBlock,
  stackLines,
  useHeadlineSound,
  // Signes
  Icon,
  LogoMotion,
  // Son
  cue,
  // Aides de temps (fonctions pures)
  clamp,
  mix,
  progress,
  hash,
  keyframes,
  springEase,
};

/** Erreurs des scènes écrites par l'IA (lues par le contrôle de rendu côté serveur). */
export const SCENE_ERRORS: Record<string, string> = {};

declare global {
  interface Window {
    __IDEM_KIT__: typeof KIT;
    __IDEM_SCENE_ERRORS__: Record<string, string>;
  }
}
window.__IDEM_KIT__ = KIT;
window.__IDEM_SCENE_ERRORS__ = SCENE_ERRORS;

const MODULES: Record<string, unknown> = { react: React, '@idem/kit': KIT };

/** Charge les scènes compilées : clé de scène → composant (les scènes en échec sont absentes). */
export function loadCustomScenes(sources: Record<string, string> | undefined): Record<string, React.ComponentType> {
  const out: Record<string, React.ComponentType> = {};
  for (const [key, js] of Object.entries(sources || {})) {
    try {
      const module = { exports: {} as Record<string, unknown> };
      const require = (name: string) => {
        if (!(name in MODULES)) throw new Error(`module interdit : ${name}`);
        return MODULES[name];
      };
      // Le code a passé le lint côté serveur (ni réseau, ni horloge, ni accès au document).
      new Function('require', 'module', 'exports', js)(require, module, module.exports);
      const component = (module.exports.default || module.exports.Scene) as React.ComponentType | undefined;
      if (typeof component !== 'function') throw new Error('aucun composant exporté par défaut');
      out[key] = component;
    } catch (error) {
      SCENE_ERRORS[key] = `chargement : ${(error as Error).message}`.slice(0, 300);
    }
  }
  return out;
}
