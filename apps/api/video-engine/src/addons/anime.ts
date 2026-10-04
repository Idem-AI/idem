/**
 * Addon anime.js v4.
 *
 * La boucle d'anime.js est coupée (`engine.useDefaultMainLoop = false`) : les
 * timelines sont créées avec `autoplay: false` et posées par `seek(ms)`. Atout
 * retenu : `stagger` en grille (depuis le centre, un coin, un point), pour les
 * fonds en vague du kit.
 */
import { createTimeline, engine, stagger, svg, utils } from 'animejs';
import { registerAddon } from '../shared';

engine.useDefaultMainLoop = false;
engine.pauseOnDocumentHidden = false;

registerAddon('anime', { createTimeline, stagger, utils, svg });
