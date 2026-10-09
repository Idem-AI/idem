/**
 * Addon GSAP (toutes les extensions sont gratuites depuis la 3.13).
 *
 * Usage vidéo : timelines EN PAUSE posées par `tl.seek(lt)` à chaque image ;
 * l'horloge de GSAP est endormie. Extensions retenues : DrawSVG (tracé),
 * MorphSVG (morphose 1→1), MotionPath (trajectoire), CustomEase (courbes de la
 * direction). SplitText n'est pas chargé : le moteur découpe déjà ses textes.
 */
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { registerAddon } from '../shared';

gsap.registerPlugin(DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin, CustomEase);
gsap.ticker.lagSmoothing(0);
gsap.ticker.sleep();
gsap.config({ autoSleep: 60, nullTargetWarn: false });

registerAddon('gsap', {
  gsap,
  CustomEase,
  timeline: (vars = {}) => gsap.timeline({ paused: true, ...vars }),
});
