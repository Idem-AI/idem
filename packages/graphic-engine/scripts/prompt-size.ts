/**
 * La TAILLE des consignes du moteur (jetons estimés, ≈ 4 signes par jeton) : auteur (système + message d'une page
 * type), plan du document, langage de la marque. Pour suivre ce que coûte une page quand on touche aux prompts.
 *
 *   npm run prompt-size --prefix packages/graphic-engine
 */
import { authorSystem, authorUser, toolLines, planPrompt, languagePrompt } from '../src/author/prompts';
import { buildTokens } from '../src/design-system/tokens';
import { FORMATS } from '../src/design-system/formats';
import { buildContentMap } from '../src/runtime/content-map';
import { BRANDS, MARKET } from './fixtures';
const tok = (s: string) => Math.ceil(s.length / 4);
for (const f of ['slide-16x9', 'a4-portrait', 'flyer-square'] as const) {
  const tokens = buildTokens({ brand: BRANDS.kora, format: f, direction: { styleId: 'swiss', grammar: 'x'.repeat(900) } });
  const ctx = { documentType: 'pitch-deck' as const, locale: 'fr', tokens, format: FORMATS[f], direction: { styleId: 'swiss', keywords: ['a', 'b'], grammar: 'x'.repeat(900) }, allowDark: false, bindings: 'values' as const };
  const sys = authorSystem(ctx);
  const user = authorUser(ctx, { section: MARKET, listing: buildContentMap(MARKET).listing, tools: toolLines(ctx, { charts: ['b2'], tables: [], icons: false }), index: 2, total: 10, language: 'y'.repeat(600), plan: { idea: 'z'.repeat(120), page: 'p'.repeat(120), previous: 'p'.repeat(120), next: 'p'.repeat(120) } });
  const d = planPrompt(ctx, Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` })), 'y'.repeat(600), []);
  const l = languagePrompt(ctx);
  console.log(f, 'author system', tok(sys), 'user', tok(user), 'plan', tok(d.system + d.user), 'language(once per brand)', tok(l.system + l.user));
}
