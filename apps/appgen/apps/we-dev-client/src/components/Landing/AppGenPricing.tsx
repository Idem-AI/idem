import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import Button from '@/components/ui/Button';

/** Ordre d'affichage des offres ; les textes vivent dans les fichiers de langue. */
const PLAN_KEYS = ['discovery', 'starter', 'pro', 'studio'] as const;
const POPULAR_PLAN = 'starter';

interface AppGenPricingProps {
  onGetStarted: () => void;
}

interface PassItem {
  name: string;
  price: string;
  note: string;
}

interface RechargeItem {
  name: string;
  price: string;
  credits: string;
}

/**
 * Tarifs.
 *
 * La section était écrite en anglais dans le code et peinte pour un fond sombre
 * (`text-gray-400`, `bg-white/5`) : illisible dès que le thème passait au
 * clair, et monolingue quelle que soit la langue choisie. Tout passe désormais
 * par l'i18n et par les jetons du design system.
 */
export function AppGenPricing({ onGetStarted }: AppGenPricingProps) {
  const { t } = useTranslation();

  // `returnObjects` rend un tableau quand la clé existe, et la clé elle-même
  // sinon. Sans ce garde-fou, une clé manquante ferait planter la page au lieu
  // de la rendre incomplète.
  const list = <T,>(key: string): T[] => {
    const value = t(key, { returnObjects: true });
    return Array.isArray(value) ? (value as T[]) : [];
  };

  const passFeatures = list<string>('landing.pricing.pass.features');
  const passes = list<PassItem>('landing.pricing.passes.items');
  const recharges = list<RechargeItem>('landing.pricing.recharges.items');

  return (
    <section id="pricing" className="px-6 py-28">
      <div className="max-w-[62rem] mx-auto">
        <div className="max-w-xl">
          <h2 className="text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em] text-balance">
            {t('landing.pricing.title')}
          </h2>
          <p className="mt-4 text-text-tertiary text-pretty">{t('landing.pricing.lede')}</p>
        </div>

        {/* Le Pass Projet porte le modèle économique : il précède les
            abonnements plutôt que de se perdre au milieu d'eux. */}
        <div className="mt-14 grid gap-10 lg:grid-cols-2 items-center rounded-3xl border border-primary/30 p-7 sm:p-10">
          <div>
            <span className="inline-block px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-semibold">
              {t('landing.pricing.pass.badge')}
            </span>
            <h3 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-balance">
              {t('landing.pricing.pass.name')}{' '}
              <span className="text-primary">{t('landing.pricing.pass.price')}</span>{' '}
              <span className="text-base font-normal text-text-tertiary">
                {t('landing.pricing.pass.once')}
              </span>
            </h3>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed text-pretty">
              {t('landing.pricing.pass.body')}
            </p>
          </div>

          <ul className="space-y-2.5">
            {passFeatures.map((feature) => (
              <FeatureLine key={feature}>{feature}</FeatureLine>
            ))}
          </ul>
        </div>

        {/* Abonnements */}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_KEYS.map((key) => {
            const popular = key === POPULAR_PLAN;
            const features = list<string>(`landing.pricing.plans.${key}.features`);

            return (
              <article
                key={key}
                className={`relative flex flex-col rounded-2xl p-6 ${
                  popular
                    ? 'border border-primary/50 bg-surface-1'
                    : 'border border-transparent'
                }`}
              >
                {popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-white text-[11px] font-semibold whitespace-nowrap">
                    {t('landing.pricing.popular')}
                  </span>
                )}

                <h3 className="text-[15px] font-semibold">{t(`landing.pricing.plans.${key}.name`)}</h3>

                <p className="mt-2">
                  <span className="text-3xl font-semibold tabular-nums text-primary">
                    {t(`landing.pricing.plans.${key}.price`)}
                  </span>
                  <span className="text-sm text-text-tertiary">
                    {t('landing.pricing.perMonth')}
                  </span>
                </p>
                <p className="text-xs text-text-disabled">
                  {t(`landing.pricing.plans.${key}.usd`)}
                </p>

                <p className="mt-3 text-sm text-text-secondary text-pretty">
                  {t(`landing.pricing.plans.${key}.tagline`)}
                </p>

                <ul className="mt-5 mb-6 grow space-y-2.5">
                  {features.map((feature) => (
                    <FeatureLine key={feature}>{feature}</FeatureLine>
                  ))}
                </ul>

                <Button
                  variant={popular ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={onGetStarted}
                  className="w-full"
                >
                  {t(`landing.pricing.plans.${key}.cta`)}
                </Button>
              </article>
            );
          })}
        </div>

        <p className="mt-5 text-sm text-text-tertiary">{t('landing.pricing.annual')}</p>

        {/* Achats ponctuels */}
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--glass-border-subtle)] p-6 sm:p-8">
            <h3 className="text-lg font-semibold">{t('landing.pricing.passes.title')}</h3>
            <p className="mt-1.5 text-sm text-text-secondary text-pretty">
              {t('landing.pricing.passes.lede')}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {passes.map((pass) => (
                <div
                  key={pass.name}
                  className="rounded-xl bg-surface-2 p-5 text-center"
                >
                  <p className="font-semibold">{pass.name}</p>
                  <p className="mt-1 text-2xl font-bold text-primary">{pass.price}</p>
                  <p className="mt-1.5 text-xs text-text-tertiary text-pretty">{pass.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--glass-border-subtle)] p-6 sm:p-8">
            <h3 className="text-lg font-semibold">{t('landing.pricing.recharges.title')}</h3>
            <p className="mt-1.5 text-sm text-text-secondary text-pretty">
              {t('landing.pricing.recharges.lede')}
            </p>
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recharges.map((recharge) => (
                <div
                  key={recharge.name}
                  className="rounded-xl bg-surface-2 p-4 text-center"
                >
                  <p className="text-xs text-text-tertiary">{recharge.name}</p>
                  <p className="mt-0.5 text-lg font-bold text-primary">{recharge.price}</p>
                  <p className="text-xs text-text-disabled">{recharge.credits}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-text-secondary">
      <Check className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
      <span className="text-pretty">{children}</span>
    </li>
  );
}

export default AppGenPricing;
