/** Les crans de la jauge, dans l'ordre (Max retiré en octobre 2026 : un ancien « max » vaut « high »). */
import type { CreativityLevel } from '../contracts/common';

const ORDER: CreativityLevel[] = ['low', 'medium', 'high', 'ultra'];

export const creativityAtLeast = (level: CreativityLevel, min: CreativityLevel): boolean => ORDER.indexOf(level) >= ORDER.indexOf(min);
