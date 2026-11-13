import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import Button, { ButtonLink } from '@/components/ui/Button';
import { ProjectPassIllustration } from '@/components/ui/Illustrations';
import { PaySection, PayStrip, PromoBanner, PromoText, useOffers, usePromotions } from '@idem/shared-promotions/react';
import { offerPriceXaf, rewriteAmount, type OffersCatalog } from '@idem/shared-promotions';

const IDEM_API = process.env.REACT_APP_IDEM_API_BASE_URL || 'http://localhost:3001';
const DASHBOARD_URL = process.env.REACT_APP_IDEM_MAIN_APP_URL || 'http://localhost:4200';

/** L'achat s'ouvre dans la console, sur sa fenêtre de confirmation (connexion d'abord si besoin). */
const buyUrl = (offer: string) => `${DASHBOARD_URL}/account/plans?buy=${offer}`;

interface AppGenPricingProps {
  onGetStarted: () => void;
}

/** Une ligne « à l'usage » : son article (prix lu sur l'API) et, si elle s'achète, son lien. */
interface UsageRow {
  key: 'change' | 'premium' | 'pack100' | 'growth' | 'launch';
  item: string;
  fallbackXaf: number;
  offer?: string;
}

const USAGE_ROWS: UsageRow[] = [
  { key: 'change', item: 'icode.modification', fallbackXaf: 25 },
  { key: 'premium', item: 'icode.premium', fallbackXaf: 75 },
  { key: 'pack100', item: 'icode.pack_100', fallbackXaf: 2000, offer: 'icode-pack-100' },
  { key: 'growth', item: 'pass.croissance', fallbackXaf: 3000, offer: 'pass-croissance' },
  { key: 'launch', item: 'pack.lancement', fallbackXaf: 5000, offer: 'pack-lancement' },
];

const price = (offers: OffersCatalog | null, item: string, fallback: number) => offerPriceXaf(offers, item) ?? fallback;

/**
 * Tarifs d'iCode — refonte du 11/11/2026, appuyée sur la recherche en psychologie des prix :
 *
 *  - **0 F pour générer, en premier** (effet du prix zéro, Shampanier, Mazar & Ariely 2007) ;
 *  - **une seule offre à retenir**, le Pass Projet, payé une fois (surcharge de choix, Iyengar &
 *    Lepper 2000) ;
 *  - **à l'usage, du moins cher au plus cher** : la première valeur lue, 25 F, « le prix d'un SMS »,
 *    sert de référence (effet d'ordre ; économie du sachet : on paie la quantité voulue) ;
 *  - **le pack 100 en pourcentage par modification** (« -20 % ») : sous 100, un pourcentage paraît
 *    plus grand qu'un écart en francs (règle des 100, Berger) ;
 *  - **le forfait au jour** (« 100 F par jour », Gourville 1998) et le Pack Lancement face à sa
 *    valeur à l'unité, l'économie en francs (au-delà de 100) ;
 *  - **les garanties** (modification ratée non débitée, code à vous, sans carte) lèvent la peur de
 *    payer pour rien.
 *
 * Tous les prix viennent de l'API (grille réglée dans le panel) ; les textes gardent un montant de
 * secours, remplacé à l'affichage.
 */
export function AppGenPricing({ onGetStarted }: AppGenPricingProps) {
  const { t, i18n } = useTranslation();
  const { promotions } = usePromotions(IDEM_API);
  const offers = useOffers(IDEM_API);
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR';
  const fmt = (value: number) => value.toLocaleString(locale);

  // `returnObjects` rend un tableau quand la clé existe, la clé elle-même sinon.
  const list = <T,>(key: string): T[] => {
    const value = t(key, { returnObjects: true });
    return Array.isArray(value) ? (value as T[]) : [];
  };

  const passXaf = price(offers, 'icode.project_pass', 1000);
  const changeXaf = price(offers, 'icode.modification', 25);
  const pack100Xaf = price(offers, 'icode.pack_100', 2000);
  const perChangeInPack = Math.round(pack100Xaf / 100);
  const packSaving = changeXaf > 0 ? Math.round((1 - perChangeInPack / changeXaf) * 100) : 0;
  const growthXaf = price(offers, 'pass.croissance', 3000);
  const launchXaf = price(offers, 'pack.lancement', 5000);
  const kitSum = offers?.kit?.sumXaf ?? 7500;
  const vitrineDay = offerPriceXaf(offers, 'meter:vitrine') ?? 10;
  const launchWorth = kitSum + passXaf + 90 * vitrineDay;

  /** Ce qui s'écrit sous le prix de chaque ligne : la lecture qui le fait paraître juste. */
  const framing: Record<UsageRow['key'], string> = {
    change: t('landing.pricing.usage.change.frame'),
    premium: t('landing.pricing.usage.premium.frame', { amount: fmt(changeXaf * 3) }),
    pack100: packSaving > 0 ? t('landing.pricing.usage.pack100.frame', { amount: fmt(perChangeInPack), saving: packSaving }) : '',
    growth: t('landing.pricing.usage.growth.frame', { amount: fmt(Math.round(growthXaf / 30)) }),
    launch: launchWorth > launchXaf ? t('landing.pricing.usage.launch.frame', { worth: fmt(launchWorth), saving: fmt(launchWorth - launchXaf) }) : '',
  };

  const rows = [...USAGE_ROWS].sort((a, b) => price(offers, a.item, a.fallbackXaf) - price(offers, b.item, b.fallbackXaf));
  const passFeatures = list<string>('landing.pricing.pass.features');
  const guarantees = list<{ title: string; text: string }>('landing.pricing.guarantees');
  const title = rewriteAmount(t('landing.pricing.title'), () => passXaf, locale);

  return (
    <section id="pricing" className="px-6 py-28">
      <div className="max-w-[68rem] mx-auto">
        <h2 className="max-w-2xl text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight text-balance">{title}</h2>
        <p className="mt-4 max-w-xl text-text-tertiary text-pretty">{t('landing.pricing.lede')}</p>
        <PayStrip lang={i18n.language} className="mt-6" />
        <PromoBanner promotions={promotions} lang={i18n.language} className="mt-6 max-w-2xl rounded-2xl border border-primary/40 bg-surface-1 px-5 py-4 text-sm text-text-secondary" />

        {/* 0 F pour générer : la gratuité d'abord. */}
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-dashed border-[var(--glass-border)] bg-surface-1 px-6 py-5">
          <p className="text-3xl font-bold tabular-nums text-primary">0&#8239;F</p>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text-primary">{t('landing.pricing.free.title')}</p>
            <p className="text-sm text-text-tertiary text-pretty">{t('landing.pricing.free.body')}</p>
          </div>
        </div>

        {/* Le Pass Projet : l'offre à retenir, payée une fois. */}
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_1fr] items-center rounded-3xl border-2 border-primary bg-surface-1 p-7 sm:p-12">
          <div>
            <h3 className="text-xl font-semibold">{t('landing.pricing.pass.name')}</h3>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[clamp(3rem,7vw,4.5rem)] font-bold leading-none tabular-nums text-text-primary">
                <PromoText promotions={promotions} offers={offers} source="icode.project_pass" item="icode.project_pass" xaf={1000} text={t('landing.pricing.pass.price')} />
              </span>
              <span className="text-base text-text-tertiary">{t('landing.pricing.pass.once')}</span>
            </p>
            <p className="mt-3 text-sm font-medium text-primary">{t('landing.pricing.pass.frame', { count: 30 })}</p>
            <p className="mt-5 max-w-md text-text-secondary leading-relaxed text-pretty">{t('landing.pricing.pass.body')}</p>
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

        {/* Ensuite, à l'usage : du moins cher au plus cher. */}
        <div className="mt-16 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h3 className="text-lg font-semibold">{t('landing.pricing.usage.title')}</h3>
            <ul className="mt-4 divide-y divide-[var(--glass-border-subtle)] border-y border-[var(--glass-border-subtle)]">
              {rows.map(({ key, item, fallbackXaf, offer }) => {
                const text = (field: string) => t(`landing.pricing.usage.${key}.${field}`);
                return (
                  <li key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-4 sm:grid-cols-[1fr_auto_6.5rem]">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary">{text('name')}</p>
                      <p className="text-sm text-text-tertiary text-pretty">{text('note')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums whitespace-nowrap text-text-primary">
                        <PromoText promotions={promotions} offers={offers} source={item} item={item} xaf={fallbackXaf} text={text('price')} />
                      </p>
                      {framing[key] ? <p className="text-xs font-medium text-primary">{framing[key]}</p> : null}
                    </div>
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

          {/* Ce qui vous protège. */}
          <div>
            <h3 className="text-lg font-semibold">{t('landing.pricing.guaranteesTitle')}</h3>
            <ul className="mt-4 space-y-5">
              {guarantees.map((guarantee) => (
                <li key={guarantee.title} className="flex gap-3">
                  <Check className="w-4 h-4 mt-1 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="font-medium text-text-primary">{guarantee.title}</p>
                    <p className="text-sm text-text-tertiary text-pretty">{guarantee.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Comment payer : la même section sur toutes les landings (mobile money, sans abonnement). */}
        <div className="mt-24">
          <PaySection offers={offers} lang={i18n.language} onCta={onGetStarted} />
        </div>
      </div>
    </section>
  );
}

export default AppGenPricing;
