import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import { ProjectPassIllustration } from '@/components/ui/Illustrations';
import { PromoBanner, PromoText, usePromotions } from '@idem/shared-promotions/react';

const IDEM_API = process.env.REACT_APP_IDEM_API_BASE_URL || 'http://localhost:3001';

const DASHBOARD_URL = process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200';

/** L'achat s'ouvre dans la console, sur sa fenêtre de confirmation (connexion d'abord si besoin). */
const buyUrl = (offer: string) => `${DASHBOARD_URL}/account/plans?buy=${offer}`;

interface AppGenPricingProps {
  onGetStarted: () => void;
}

/**
 * Les rangées « à l'usage », dans l'ordre d'affichage. Celles qui s'achètent ont leur
 * lien de souscription ; les autres se paient au fil de l'eau depuis le builder.
 */
const USAGE_ROWS: { key: string; offer?: string; item?: string; xaf?: number }[] = [
  { key: 'generate' },
  { key: 'change', item: 'icode.modification', xaf: 25 },
  { key: 'premium', item: 'icode.premium', xaf: 75 },
  { key: 'pack100', offer: 'icode-pack-100', item: 'icode.pack_100', xaf: 2000 },
  { key: 'growth', offer: 'pass-croissance', item: 'pass.croissance', xaf: 3000 },
  { key: 'launch', offer: 'pack-lancement', item: 'pack.lancement', xaf: 5000 },
];

/**
 * Tarifs d'iCode : une seule offre à retenir, le Pass Projet (1 000 F), et son bouton
 * « Commencer ». Le reste, ce qu'on paie ensuite à l'usage, tient dans une liste simple ;
 * chaque offre qui s'achète a son lien pour y souscrire.
 */
export function AppGenPricing({ onGetStarted }: AppGenPricingProps) {
  const { t } = useTranslation();
  // Promotions en cours : les prix se barrent (« 1 000 F » → « 0 F CFA ») pendant une campagne.
  const { promotions } = usePromotions(IDEM_API);

  // `returnObjects` rend un tableau quand la clé existe, et la clé elle-même
  // sinon : une clé manquante rend la section incomplète au lieu de la casser.
  const list = <T,>(key: string): T[] => {
    const value = t(key, { returnObjects: true });
    return Array.isArray(value) ? (value as T[]) : [];
  };

  const passFeatures = list<string>('landing.pricing.pass.features');

  return (
    <section id="pricing" className="px-6 py-28">
      <div className="max-w-[68rem] mx-auto">
        <h2 className="max-w-2xl text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight text-balance">
          {t('landing.pricing.title')}
        </h2>
        <p className="mt-4 max-w-xl text-text-tertiary text-pretty">{t('landing.pricing.lede')}</p>
        <PromoBanner promotions={promotions} className="mt-6 max-w-2xl rounded-2xl border border-primary/40 bg-surface-1 px-5 py-4 text-sm text-text-secondary" />

        {/* Le Pass Projet : l'offre à retenir, et l'action principale de la section. */}
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_1fr] items-center rounded-3xl border-2 border-primary bg-surface-1 p-7 sm:p-12">
          <div>
            <h3 className="text-xl font-semibold">{t('landing.pricing.pass.name')}</h3>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[clamp(3rem,7vw,4.5rem)] font-bold leading-none tabular-nums text-text-primary">
                <PromoText promotions={promotions} item="icode.project_pass" xaf={1000} text={t('landing.pricing.pass.price')} />
              </span>
              <span className="text-base text-text-tertiary">{t('landing.pricing.pass.once')}</span>
            </p>
            <p className="mt-5 max-w-md text-text-secondary leading-relaxed text-pretty">
              {t('landing.pricing.pass.body')}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button variant="primary" size="lg" onClick={onGetStarted}>
                {t('landing.pricing.pass.cta')}
              </Button>
              <span className="text-sm text-text-tertiary">{t('landing.pricing.pass.ctaNote')}</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-8 lg:items-start">
            <ProjectPassIllustration size={150} />
            <ul className="space-y-3">
              {passFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-text-secondary">
                  <Check className="w-4 h-4 mt-1 shrink-0 text-primary" aria-hidden />
                  <span className="text-pretty">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Ensuite, à l'usage : une liste, pas une grille de cartes. */}
        <div className="mt-16 max-w-3xl">
          <h3 className="text-lg font-semibold">{t('landing.pricing.usage.title')}</h3>
          <ul className="mt-4 divide-y divide-[var(--glass-border-subtle)] border-y border-[var(--glass-border-subtle)]">
            {USAGE_ROWS.map(({ key, offer, item, xaf }) => {
              const text = (field: string) => t(`landing.pricing.usage.${key}.${field}`);
              return (
                <li key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-4 sm:grid-cols-[1fr_auto_6.5rem]">
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary">{text('name')}</p>
                    <p className="text-sm text-text-tertiary text-pretty">{text('note')}</p>
                  </div>
                  <p className="font-semibold tabular-nums whitespace-nowrap text-text-primary">
                    {item && xaf ? <PromoText promotions={promotions} item={item} xaf={xaf} text={text('price')} /> : text('price')}
                  </p>
                  <div className="col-span-2 sm:col-span-1 sm:justify-self-end">
                    {offer && (
                      <ButtonLink variant="secondary" size="sm" href={buyUrl(offer)}>
                        {t('landing.pricing.usage.choose')}
                      </ButtonLink>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 text-sm text-text-tertiary text-pretty">{t('landing.pricing.wallet')}</p>
        </div>
      </div>
    </section>
  );
}

export default AppGenPricing;
