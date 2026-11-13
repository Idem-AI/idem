import { useMemo } from 'react';
import type { OffersCatalog } from '../offers';
import { PAYMENT_OPERATORS } from '../operators';
import { COWRIES_SVG, PAY_CSS, pageLang, payTexts } from '../pay-section';

/** « Payez avec votre téléphone » : même balisage et même feuille de style que `<idem-pay-section>`. */
export function PaySection({ offers = null, lang = null, ctaHref = null, onCta }: { offers?: OffersCatalog | null; lang?: string | null; ctaHref?: string | null; onCta?: () => void }) {
  const t = useMemo(() => payTexts(pageLang(lang), offers), [lang, offers]);
  return (
    <>
      <style>{PAY_CSS}</style>
      <section className="idem-pay" aria-labelledby="idem-pay-title">
        <div className="idem-pay-top">
          <div>
            <h2 className="idem-pay-title" id="idem-pay-title">
              {t.title[0]}
              <span className="idem-pay-wave">{t.title[1]}</span>
              {t.title[2]}
            </h2>
            <p className="idem-pay-lead">{t.lead}</p>
            <ul className="idem-pay-promises">
              {t.promises.map((promise) => (
                <li key={promise}>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {promise}
                </li>
              ))}
            </ul>
          </div>
          <div className="idem-pay-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: COWRIES_SVG }} />
        </div>

        <div className="idem-pay-ops">
          <p className="idem-pay-ops-title">{t.operatorsTitle}</p>
          <ul className="idem-pay-ops-grid">
            {PAYMENT_OPERATORS.map((operator, index) => (
              <li key={operator.id} className={index === 0 ? 'idem-pay-op idem-pay-op-first' : 'idem-pay-op'} style={operator.tile ? { background: operator.tile } : undefined}>
                <img src={operator.logo} alt={operator.name} loading="lazy" decoding="async" />
              </li>
            ))}
          </ul>
        </div>

        <ol className="idem-pay-steps">
          {t.steps.map((step, index) => (
            <li key={step.title} className="idem-pay-step">
              <span className="idem-pay-step-num" aria-hidden="true">
                {index + 1}
              </span>
              <p className="idem-pay-step-title">{step.title}</p>
              <p className="idem-pay-step-text">{step.text}</p>
            </li>
          ))}
        </ol>

        {ctaHref || onCta ? (
          <div className="idem-pay-foot">
            {ctaHref ? (
              <a className="idem-pay-cta" href={ctaHref}>
                {t.cta}
              </a>
            ) : (
              <button type="button" className="idem-pay-cta" onClick={onCta} style={{ border: 0, cursor: 'pointer' }}>
                {t.cta}
              </button>
            )}
            <p>{t.ctaNote}</p>
          </div>
        ) : null}
      </section>
    </>
  );
}

/** « Payé en mobile money », les logos en petit : pour les héros des pages de prix. */
export function PayStrip({ lang = null, className }: { lang?: string | null; className?: string }) {
  const t = payTexts(pageLang(lang), null).strip;
  return (
    <>
      <style>{PAY_CSS}</style>
      <p className={className ? `idem-pay-strip ${className}` : 'idem-pay-strip'}>
        <span className="idem-pay-strip-label">{t.label}</span>
        <span className="idem-pay-strip-logos" role="list">
          {PAYMENT_OPERATORS.map((operator) => (
            <span key={operator.id} role="listitem" className="idem-pay-strip-logo" style={operator.tile ? { background: operator.tile } : undefined}>
              <img src={operator.logo} alt={operator.name} />
            </span>
          ))}
        </span>
        <span className="idem-pay-strip-note">{t.note}</span>
      </p>
    </>
  );
}
