import { bannerPromotion, promotionTexts } from '../client';
import { pageLang } from '../pay-section';
import { localAmountAfter, priceWithPromotions } from '../engine';
import { currencyUnit, formatAmount, freeLabel, rewriteAmount, srLabels } from '../format';
import type { PublicPromotion } from '../model';
import { offerPriceXaf, type OffersCatalog } from '../offers';

export interface PromoPriceProps {
  promotions: PublicPromotion[];
  item: string | null;
  xaf: number;
  amount?: number | null;
  currency?: string;
  decimals?: number;
  unit?: string | null;
  showBadge?: boolean;
  className?: string;
}

const srOnly = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const;

/** Un prix, barré quand une promotion le réduit — même rendu que `<idem-promo-price>`. */
export function PromoPrice({ promotions, item, xaf, amount = null, currency = 'XAF', decimals = 0, unit = null, showBadge = true, className }: PromoPriceProps) {
  const price = priceWithPromotions(promotions, item, xaf);
  const base = amount ?? xaf;
  const suffix = unit ?? currencyUnit(currency);
  const write = (value: number) => (suffix ? `${formatAmount(value, decimals)} ${suffix}` : formatAmount(value, decimals));
  const promotion = price.applied[0] ? promotions.find((entry) => entry.id === price.applied[0].id) : undefined;
  if (price.discountXaf <= 0 || promotion?.display?.strikethrough === false) return <span className={className}>{write(base)}</span>;
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.4em' }}>
      <del style={{ fontSize: '0.62em', fontWeight: 500, opacity: 0.7 }}>
        <span style={srOnly}>{srLabels().normal} </span>
        {write(base)}
      </del>
      <span>
        <span style={srOnly}>{srLabels().promo} </span>
        {price.free ? freeLabel() : write(localAmountAfter(price, base, decimals))}
      </span>
      {showBadge && promotion && promotionTexts(promotion, pageLang()).badge ? (
        <span style={{ fontSize: '0.5em', fontWeight: 600, padding: '0.15em 0.55em', borderRadius: 999, alignSelf: 'center', background: 'color-mix(in srgb, currentColor 10%, transparent)' }}>
          {promotionTexts(promotion, pageLang()).badge}
        </span>
      ) : null}
    </span>
  );
}

/** Le bandeau de la campagne en cours, ou rien. */
export function PromoBanner({ promotions, className, lang }: { promotions: PublicPromotion[]; className?: string; lang?: string | null }) {
  const promo = bannerPromotion(promotions);
  if (!promo) return null;
  const texts = promotionTexts(promo, pageLang(lang));
  const until = promo.endsAt ? texts.until(promo.endsAt) : '';
  return (
    <aside role="status" aria-label={texts.title} className={className}>
      <strong>{texts.title}</strong> {texts.message}
      {until ? <span style={{ display: 'block', opacity: 0.75, fontSize: '0.85em' }}>{until}</span> : null}
    </aside>
  );
}

/** Une chaîne de prix existante, barrée et réécrite avec le montant remisé (même rendu que `<idem-promo-text>`). */
export function PromoText({
  promotions,
  item,
  xaf: fallbackXaf,
  text: fallbackText,
  className,
  offers = null,
  source = null,
}: {
  promotions: PublicPromotion[];
  item: string | null;
  xaf: number;
  text: string;
  className?: string;
  /** Catalogue servi par l'API (`useOffers`) et où y lire le prix : le montant écrit n'est qu'un secours. */
  offers?: OffersCatalog | null;
  source?: string | null;
}) {
  const live = source ? offerPriceXaf(offers, source) : null;
  const xaf = live ?? fallbackXaf;
  const text = live !== null && live !== fallbackXaf ? rewriteAmount(fallbackText, () => live) : fallbackText;
  const price = priceWithPromotions(promotions, item, xaf);
  const promotion = price.applied[0] ? promotions.find((entry) => entry.id === price.applied[0].id) : undefined;
  if (price.discountXaf <= 0 || promotion?.display?.strikethrough === false) return <span className={className}>{text}</span>;
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.4em' }}>
      <del style={{ opacity: 0.7 }}>
        <span style={srOnly}>{srLabels().normal} </span>
        {text}
      </del>
      <span>
        <span style={srOnly}>{srLabels().promo} </span>
        {price.free ? freeLabel() : rewriteAmount(text, (amount) => localAmountAfter(price, amount))}
      </span>
    </span>
  );
}
