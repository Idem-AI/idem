/**
 * Montants affichés à côté d'une promotion. En zone CFA : « 2 500 F CFA » ; ailleurs le code de la
 * devise (« 0 GHS », « 1 200 KES »). Espaces fines insécables : un prix ne se coupe jamais en deux.
 */

const CFA = new Set(['XAF', 'XOF']);

export function currencyUnit(currency = 'XAF'): string {
  return CFA.has(currency.toUpperCase()) ? 'F CFA' : currency.toUpperCase();
}

export function formatAmount(amount: number, decimals = 0, locale = 'fr-FR'): string {
  return amount
    .toLocaleString(locale, { minimumFractionDigits: amount === 0 ? 0 : decimals, maximumFractionDigits: decimals })
    .replace(/\s/g, ' ');
}

export function formatMoney(amount: number, currency = 'XAF', decimals = 0, locale = 'fr-FR'): string {
  return `${formatAmount(amount, decimals, locale)} ${currencyUnit(currency)}`;
}

/**
 * Une chaîne de prix déjà écrite (« 10 F par jour », « 3 000 F CFA », « 45 GHS ») réécrite avec le
 * montant remisé, le reste intact : les écrans traduits gardent leurs mots. Quand le prix tombe à
 * zéro, « F » devient « F CFA » (« 0 F CFA par jour ») pour que la gratuité se lise sans ambiguïté.
 */
export function rewriteAmount(original: string, finalOf: (amount: number) => number, locale = 'fr-FR'): string {
  const match = original.match(/\d[\d\s  .,]*\d|\d/);
  if (!match) return original;
  const raw = match[0];
  const amount = Number(raw.replace(/[^\d]/g, ''));
  if (!Number.isFinite(amount)) return original;
  const final = finalOf(amount);
  let out = original.replace(raw, formatAmount(final, 0, locale));
  if (final === 0) out = out.replace(/^(\s*0[\s  ]*)F(?![A-Za-z])(?![\s  ]*CFA)/, '$1F CFA');
  return out;
}
