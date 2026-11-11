import type { OffersCatalog } from './offers';

/**
 * « Payez avec votre téléphone » — la section qui explique le paiement, IDENTIQUE sur toutes les
 * landings (IDEM, iCode, iDeploy) : mêmes textes, même balisage, même feuille de style (`PAY_CSS`),
 * rendue par `<idem-pay-section>` (Angular) et `<PaySection>` (React).
 *
 * Ce qu'elle doit faire comprendre en un regard : on paie par mobile money (logos des opérateurs,
 * Orange Money en premier), sans carte bancaire, sans abonnement obligatoire, en rechargeant à
 * partir de petits montants — la logique « au détail » des achats du quotidien.
 */

export type PayLang = 'fr' | 'en';

export interface PayTexts {
  title: [string, string, string];
  lead: string;
  promises: string[];
  operatorsTitle: string;
  steps: { title: string; text: string }[];
  cta: string;
  ctaNote: string;
  strip: { label: string; note: string };
}

const fmt = (value: number, lang: PayLang) => value.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR');

/** Les montants de la recharge, lus sur l'API (`/billing/offers`), sinon les valeurs actuelles. */
export function topupFigures(offers: OffersCatalog | null | undefined): { min: number; bonuses: { from: number; percent: number }[] } {
  const topup = offers?.topup;
  const bonuses = (topup?.bonuses ?? [
    { fromXaf: 10_000, rate: 0.1 },
    { fromXaf: 5_000, rate: 0.05 },
  ])
    .map((bonus) => ({ from: bonus.fromXaf, percent: Math.round(bonus.rate * 100) }))
    .sort((a, b) => a.from - b.from);
  return { min: topup?.minXaf ?? 100, bonuses };
}

export function payTexts(lang: PayLang, offers: OffersCatalog | null | undefined): PayTexts {
  const { min, bonuses } = topupFigures(offers);
  const bonusLine = bonuses.map((bonus) => (lang === 'en' ? `+${bonus.percent}% from ${fmt(bonus.from, lang)} F` : `+${bonus.percent} % dès ${fmt(bonus.from, lang)} F`)).join(lang === 'en' ? ', ' : ', ');
  if (lang === 'en') {
    return {
      title: ['Pay with ', 'your phone', '.'],
      lead: `Everything is paid by mobile money, with no bank card and no subscription. You top up your IDEM wallet when you want, from ${fmt(min, lang)} F, and you only pay for what you keep.`,
      promises: ['No bank card', 'No subscription required', 'Confirmed with your PIN code'],
      operatorsTitle: 'Accepted mobile money',
      steps: [
        { title: 'Top up your wallet', text: `From ${fmt(min, lang)} F, from your phone. Bonus: ${bonusLine}.` },
        { title: 'Choose what you keep', text: 'A final version, a plan, a pack: the price is shown before you pay, nothing is charged without your OK.' },
        { title: 'It is yours', text: 'Files without the mark, your site online. A failed generation is refunded automatically.' },
      ],
      cta: 'Start for free',
      ctaNote: 'Your wallet is created with your account.',
      strip: { label: 'Paid by mobile money', note: 'no bank card, no subscription' },
    };
  }
  return {
    title: ['Payez avec ', 'votre téléphone', '.'],
    lead: `Tout se paie en mobile money, sans carte bancaire et sans abonnement. Vous rechargez votre portefeuille IDEM quand vous voulez, dès ${fmt(min, lang)} F, et vous ne payez que ce que vous gardez.`,
    promises: ['Sans carte bancaire', 'Aucun abonnement obligatoire', 'Confirmé avec votre code PIN'],
    operatorsTitle: 'Mobile money acceptés',
    steps: [
      { title: 'Rechargez votre portefeuille', text: `Dès ${fmt(min, lang)} F, depuis votre téléphone. Bonus : ${bonusLine}.` },
      { title: 'Choisissez ce que vous gardez', text: 'Une version finale, un forfait, un pack : le prix s’affiche avant de payer, rien n’est débité sans votre accord.' },
      { title: 'C’est à vous', text: 'Fichiers sans signature, site en ligne. Une génération ratée est remboursée automatiquement.' },
    ],
    cta: 'Commencer gratuitement',
    ctaNote: 'Votre portefeuille se crée avec votre compte.',
    strip: { label: 'Payé en mobile money', note: 'sans carte bancaire, sans abonnement' },
  };
}

/** La langue d'une page : `<html lang>`, sinon le français. */
export function pageLang(explicit?: string | null): PayLang {
  const lang = (explicit ?? (typeof document !== 'undefined' ? document.documentElement.lang : '') ?? 'fr').toLowerCase();
  return lang.startsWith('en') ? 'en' : 'fr';
}

/**
 * La calebasse de cauris : l'argent, le paiement (AGENTS.md § 4, même dessin et même sens que la
 * landing). Deux encres : le trait en `currentColor`, le cauris du centre en couleur.
 */
export const COWRIES_SVG = `<svg viewBox="0 0 120 88" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
<g transform="translate(0 6)"><g stroke-width="1.6">
<g transform="translate(44 30) rotate(-24) scale(0.62)"><path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.6"/><path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2.2"/></g>
<g transform="translate(76 29) rotate(20) scale(0.62)"><path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.6"/><path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2.2"/></g></g>
<path d="M16 36 C16 60 36 74 60 74 C84 74 104 60 104 36" stroke-width="1.8"/><path d="M14 36 H106" stroke-width="2"/>
<path d="M28 52 L34 47 L40 52 L46 47 L52 52 L58 47 L64 52 L70 47 L76 52 L82 47 L88 52 L92 49" stroke-width="1.3" opacity=".7"/><path d="M34 62 H86" stroke-width="1.2" opacity=".5"/>
<g style="color: var(--idem-pay-accent, var(--color-primary-500))" transform="translate(60 25) scale(0.78)"><path d="M0 -13 C9 -13 12 -5 12 0 C12 8 7 13 0 13 C-7 13 -12 8 -12 0 C-12 -5 -9 -13 0 -13Z" stroke-width="2.4"/><path d="M0 -10 C2 -4 -2 4 0 10" stroke-width="2"/><path d="M-4 -5.5h2.2 M-4.4 -1.8h2.4 M-4.4 1.8h2.4 M-4 5.5h2.2 M2 -5.5h2.2 M2.2 -1.8h2.4 M2.2 1.8h2.4 M2 5.5h2.2" stroke-width="1.6"/></g>
</g></svg>`;

/**
 * La feuille de style commune (préfixe `idem-pay-`), injectée telle quelle par les deux
 * frameworks. La section est un grand aplat de la couleur primaire (le paiement est LA promesse à
 * retenir), le texte en `--color-on-primary`, l'accent en cyan (`--color-accent-500`, celui du
 * soulignement des titres). Les logos sont posés sur des pastilles blanches (fond neutre attendu par
 * les marques), celle de MTN à sa couleur.
 */
export const PAY_CSS = `
.idem-pay { --idem-pay-ink: var(--color-on-primary, #fff); --idem-pay-accent: var(--color-accent-500, #22d3ee);
  position: relative; margin-inline: auto; max-width: 76rem; padding: clamp(2rem, 6vw, 5rem) clamp(1.25rem, 5vw, 4.5rem);
  border-radius: clamp(1.5rem, 3vw, 2.5rem); background: var(--color-primary-500, #1447e6); color: var(--idem-pay-ink); overflow: hidden; isolation: isolate; }
.idem-pay::after { content: ''; position: absolute; inset: auto -10% -45% auto; width: 60%; aspect-ratio: 1; border-radius: 50%; z-index: -1;
  background: color-mix(in srgb, var(--color-primary-700, #10267a) 70%, transparent); }
.idem-pay-top { display: grid; gap: 2rem; align-items: center; grid-template-columns: 1fr; }
@media (min-width: 900px) { .idem-pay-top { grid-template-columns: 1.6fr 1fr; } }
.idem-pay-title { margin: 0; font-size: clamp(2.4rem, 6vw, 4.5rem); line-height: 1.02; font-weight: 800; letter-spacing: -0.025em; color: var(--idem-pay-ink); text-wrap: balance; }
.idem-pay-wave { background: url("data:image/svg+xml,%3Csvg width='100' height='10' viewBox='0 0 100 10' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 5 Q25 10 50 5 T100 5' stroke='%2322D3EE' stroke-width='3' fill='none'/%3E%3C/svg%3E") repeat-x;
  background-position: 0 100%; background-size: auto 17px; padding-bottom: 10px; }
.idem-pay-lead { margin: 1.5rem 0 0; max-width: 38rem; font-size: clamp(1.1rem, 1.7vw, 1.3rem); line-height: 1.6; color: color-mix(in srgb, var(--idem-pay-ink) 88%, transparent); text-wrap: pretty; }
.idem-pay-promises { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1.75rem 0 0; padding: 0; list-style: none; }
.idem-pay-promises li { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.55rem 1rem; border-radius: 999px; font-size: 0.98rem; font-weight: 700; color: var(--idem-pay-ink);
  background: color-mix(in srgb, var(--idem-pay-ink) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--idem-pay-ink) 22%, transparent); }
.idem-pay-promises svg { width: 1rem; height: 1rem; color: var(--idem-pay-accent); flex: none; }
.idem-pay-art { justify-self: center; width: min(85%, 22rem); color: color-mix(in srgb, var(--idem-pay-ink) 75%, transparent); }
.idem-pay-art svg { display: block; width: 100%; height: auto; }
.idem-pay-ops { margin-top: clamp(2.5rem, 6vw, 4rem); }
.idem-pay-ops-title { margin: 0 0 1rem; font-size: 1.05rem; font-weight: 700; color: var(--idem-pay-ink); }
.idem-pay-ops-grid { display: grid; gap: 0.85rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; }
@media (min-width: 560px) { .idem-pay-ops-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 960px) { .idem-pay-ops-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
.idem-pay-op { display: flex; align-items: center; justify-content: center; height: clamp(5rem, 10vw, 6.5rem); padding: 0.85rem 1.1rem; min-width: 0; border-radius: 1.25rem; background: #fff;
  box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.45); transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
.idem-pay-op:hover { transform: translateY(-3px); }
.idem-pay-op img { display: block; width: 100%; height: 100%; object-fit: contain; }
.idem-pay-op-first { box-shadow: 0 0 0 3px var(--idem-pay-accent), 0 10px 30px -12px rgba(0, 0, 0, 0.45); }
.idem-pay-steps { display: grid; gap: 2rem; grid-template-columns: 1fr; margin: clamp(3rem, 7vw, 4.5rem) 0 0; padding: 0; list-style: none; }
@media (min-width: 820px) { .idem-pay-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2.5rem; } }
.idem-pay-step { padding-top: 1.25rem; border-top: 1px solid color-mix(in srgb, var(--idem-pay-ink) 30%, transparent); }
.idem-pay-step-num { display: block; font-size: clamp(3rem, 6vw, 4.25rem); line-height: 0.9; font-weight: 800; color: var(--idem-pay-accent); font-variant-numeric: tabular-nums; }
.idem-pay-step-title { margin: 0.85rem 0 0; font-size: 1.2rem; font-weight: 700; color: var(--idem-pay-ink); }
.idem-pay-step-text { margin: 0.45rem 0 0; font-size: 1rem; line-height: 1.6; color: color-mix(in srgb, var(--idem-pay-ink) 85%, transparent); }
.idem-pay-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem 1.5rem; margin-top: clamp(2.5rem, 6vw, 3.5rem); }
.idem-pay-foot p { margin: 0; font-size: 0.98rem; color: color-mix(in srgb, var(--idem-pay-ink) 85%, transparent); }
.idem-pay-cta { display: inline-flex; align-items: center; justify-content: center; min-height: 3.25rem; padding: 0 1.75rem; border-radius: 999px; font-weight: 700; font-size: 1.05rem;
  background: var(--idem-pay-ink); color: var(--color-primary-500, #1447e6); text-decoration: none; transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
.idem-pay-cta:hover { transform: translateY(-2px); }
.idem-pay-cta:focus-visible, .idem-pay-op:focus-visible { outline: 3px solid var(--idem-pay-accent); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .idem-pay-op, .idem-pay-cta { transition: none; } .idem-pay-op:hover, .idem-pay-cta:hover { transform: none; } }

/* Le bandeau compact des héros : « Payé en mobile money », les logos en petit. */
.idem-pay-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 0.9rem; margin: 0; }
.idem-pay-strip-label { font-size: 1.05rem; font-weight: 800; color: var(--color-text-primary); }
.idem-pay-strip-note { font-size: 0.9rem; color: var(--color-text-secondary); }
.idem-pay-strip-logos { display: inline-flex; flex-wrap: wrap; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.idem-pay-strip-logo { display: flex; align-items: center; justify-content: center; height: 2.4rem; padding: 0.3rem 0.5rem; border-radius: 0.55rem; background: #fff; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08); }
.idem-pay-strip-logo img { display: block; height: 1.6rem; width: 3.6rem; object-fit: contain; }
.idem-pay-vh { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;
