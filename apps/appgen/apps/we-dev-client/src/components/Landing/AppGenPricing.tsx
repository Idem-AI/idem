interface Plan {
  name: string;
  price: string;
  usd: string;
  tagline: string;
  features: string[];
  popular?: boolean;
  cta: string;
}

const PLANS: Plan[] = [
  {
    name: 'Discovery',
    price: '0 F',
    usd: 'free forever',
    tagline: 'Generate complete apps and watch them run, free.',
    features: [
      '3 complete generations per day',
      'Unlimited browser preview',
      'Project Pass at 999 F per project',
      'Community support',
    ],
    cta: 'Start free',
  },
  {
    name: 'Starter',
    price: '2 999 F',
    usd: '~$5.2/month',
    tagline: '7× cheaper per credit than Lovable Pro.',
    features: [
      'Unlimited initial generations',
      'Project Pass included on all projects',
      '150 credits/month, 2-month rollover',
      'Import existing projects',
      'Standard support',
    ],
    popular: true,
    cta: 'Get started',
  },
  {
    name: 'Pro',
    price: '9 999 F',
    usd: '~$17/month',
    tagline: 'For builders shipping every week.',
    features: [
      'Everything in Starter',
      '550 credits/month',
      'Premium AI models for complex actions',
      'Priority support',
    ],
    cta: 'Go Pro',
  },
  {
    name: 'Studio',
    price: '24 999 F',
    usd: '~$43/month',
    tagline: 'For agencies building for their clients.',
    features: [
      'Everything in Pro',
      '1,500 credits/month',
      '5 seats',
      'API access',
      'White-label for agencies',
      'Dedicated support',
    ],
    cta: 'Scale up',
  },
];

const PASS_FEATURES = [
  'AI modifications unlocked (30 credits included)',
  'Unlimited code download (ZIP)',
  'Unlimited GitHub push',
  'Deployment on iDeploy unlocked',
  'Private project + removable badge',
];

const RECHARGES = [
  { name: 'Boost', price: '500 F', credits: '25 credits' },
  { name: 'Standard', price: '999 F', credits: '55 credits' },
  { name: 'Growth', price: '2 499 F', credits: '145 credits' },
  { name: 'Power', price: '4 999 F', credits: '320 credits' },
];

const PASSES = [
  { name: '24h Pass', price: '500 F', note: '25 credits — "I\'m testing my idea tonight"' },
  { name: '7-day Pass', price: '1 499 F', note: '90 credits — "I\'m prepping Friday\'s demo"' },
];

interface AppGenPricingProps {
  onGetStarted: () => void;
}

export function AppGenPricing({ onGetStarted }: AppGenPricingProps) {
  return (
    <section id="pricing" className="py-32 px-4 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Generating is free. Owning costs almost nothing.
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Describe your idea and watch your app run in the browser for free. Pay only when you
            want to own it — in FCFA, by Mobile Money.
          </p>
        </div>

        {/* Project Pass highlight */}
        <div className="glass-card rounded-2xl border-2 border-primary/60 p-8 lg:p-10 mb-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-block px-3 py-1 bg-primary/90 rounded-full text-xs font-bold text-white mb-4">
              The heart of the model
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-3">
              Project Pass <span className="text-primary ml-2">999 F</span>{' '}
              <span className="text-gray-500 text-base font-normal">— once per project (~$1.7)</span>
            </h3>
            <p className="text-gray-400 leading-relaxed">
              The initial generation is 100% free and the preview is unlimited. When your app works
              and you want it — download it, push it, deploy it — unlock it for less than a
              restaurant meal.
            </p>
          </div>
          <ul className="space-y-3">
            {PASS_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-gray-300">
                <svg
                  className="w-4 h-4 text-primary mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.popular
                  ? 'glass-card p-6 rounded-2xl border-2 border-primary relative flex flex-col'
                  : 'glass-card p-6 rounded-2xl border border-white/10 relative flex flex-col'
              }
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary rounded-full text-xs font-bold text-white">
                  Most popular
                </div>
              )}
              <h3 className="text-lg font-bold mb-2">{plan.name}</h3>
              <div className="mb-1">
                <span className="text-3xl font-bold text-primary">{plan.price}</span>
                <span className="text-gray-500 text-sm">/month</span>
              </div>
              <div className="text-xs text-gray-500 mb-3">{plan.usd}</div>
              <p className="text-sm text-gray-400 mb-5">{plan.tagline}</p>
              <ul className="space-y-2.5 mb-6 grow">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
                    <svg
                      className="w-4 h-4 text-primary mt-0.5 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={onGetStarted}
                className={
                  plan.popular
                    ? 'inner-button w-full py-3 text-sm text-center'
                    : 'outer-button w-full py-3 text-sm text-center'
                }
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 mb-16">
          Annual billing: 2 months free (-16%) — payable by Mobile Money in 1 or 3 installments.
        </p>

        {/* Telecom passes + recharges */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl border border-white/10 p-8">
            <h3 className="text-xl font-bold mb-2">Telecom-style passes</h3>
            <p className="text-sm text-gray-400 mb-6">
              Like a data plan: pay only for the days you build.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PASSES.map((pass) => (
                <div
                  key={pass.name}
                  className="bg-white/5 border border-white/5 rounded-xl p-5 text-center"
                >
                  <div className="font-bold mb-1">{pass.name}</div>
                  <div className="text-2xl font-bold text-primary mb-2">{pass.price}</div>
                  <div className="text-xs text-gray-500">{pass.note}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card rounded-2xl border border-white/10 p-8">
            <h3 className="text-xl font-bold mb-2">Credit recharges</h3>
            <p className="text-sm text-gray-400 mb-6">
              No commitment, valid 12 months, cheaper as you go up.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {RECHARGES.map((recharge) => (
                <div
                  key={recharge.name}
                  className="bg-white/5 border border-white/5 rounded-xl p-4 text-center"
                >
                  <div className="text-xs text-gray-400 mb-1">{recharge.name}</div>
                  <div className="text-lg font-bold text-primary">{recharge.price}</div>
                  <div className="text-xs text-gray-500">{recharge.credits}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AppGenPricing;
