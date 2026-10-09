/**
 * Addon flubber : morphose de formes SVG, fonction pure du temps.
 *
 * Sa force : une forme → plusieurs (`separate`), un cercle → un tracé
 * (`fromCircle`). C'est ce qu'il faut pour qu'un point devienne le logo, quel que
 * soit le nombre de formes qui le composent.
 */
import { fromCircle, interpolate, separate } from 'flubber';
import { registerAddon } from '../shared';

registerAddon('flubber', { interpolate, fromCircle, separate });
