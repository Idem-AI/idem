import { bannerPromotion } from '../client';
import { localAmountAfter, priceWithPromotions } from '../engine';
import { currencyUnit, formatAmount, rewriteAmount } from '../format';
import type { PublicPromotion } from '../model';

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
        <span style={srOnly}>Prix normal : </span>
        {write(base)}
      </del>
      <span>
        <span style={srOnly}>Prix pendant la promotion : </span>
        {write(localAmountAfter(price, base, decimals))}
      </span>
      {showBadge && promotion?.display?.badge ? (
        <span style={{ fontSize: '0.5em', fontWeight: 600, padding: '0.15em 0.55em', borderRadius: 999, alignSelf: 'center', background: 'color-mix(in srgb, currentColor 10%, transparent)' }}>
          {promotion.display.badge}
        </span>
      ) : null}
    </span>
  );
}

/** Le bandeau de la campagne en cours, ou rien. */
export function PromoBanner({ promotions, className }: { promotions: PublicPromotion[]; className?: string }) {
  const promo = bannerPromotion(promotions);
  if (!promo) return null;
  const until = promo.endsAt ? new Date(promo.endsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return (
    <aside role="status" aria-label={promo.display.title} className={className}>
      <strong>{promo.display.title}</strong> {promo.display.message}
      {until ? <span style={{ display: 'block', opacity: 0.75, fontSize: '0.85em' }}>Jusqu’au {until}</span> : null}
    </aside>
  );
}

/** Une chaîne de prix existante, barrée et réécrite avec le montant remisé (même rendu que `<idem-promo-text>`). */
export function PromoText({ promotions, item, xaf, text, className }: { promotions: PublicPromotion[]; item: string | null; xaf: number; text: string; className?: string }) {
  const price = priceWithPromotions(promotions, item, xaf);
  const promotion = price.applied[0] ? promotions.find((entry) => entry.id === price.applied[0].id) : undefined;
  if (price.discountXaf <= 0 || promotion?.display?.strikethrough === false) return <span className={className}>{text}</span>;
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.4em' }}>
      <del style={{ opacity: 0.7 }}>
        <span style={srOnly}>Prix normal : </span>
        {text}
      </del>
      <span>
        <span style={srOnly}>Prix pendant la promotion : </span>
        {rewriteAmount(text, (amount) => localAmountAfter(price, amount))}
      </span>
    </span>
  );
}
