<?php

namespace App\Livewire\Idem;

use Livewire\Component;
use App\Services\IdemSubscriptionService;
use App\Services\IdemQuotaService;
use App\Services\IdemStripeService;

class SubscriptionDashboard extends Component
{
    public $subscription;
    public $quotas;
    public $availablePlans;
    public $showUpgradeModal = false;
    public $selectedPlan = null;

    protected IdemSubscriptionService $subscriptionService;
    protected IdemQuotaService $quotaService;
    protected IdemStripeService $stripeService;

    public function boot(
        IdemSubscriptionService $subscriptionService,
        IdemQuotaService $quotaService,
        IdemStripeService $stripeService
    ) {
        $this->subscriptionService = $subscriptionService;
        $this->quotaService = $quotaService;
        $this->stripeService = $stripeService;
    }

    public function mount()
    {
        $this->loadData();
    }

    public function loadData()
    {
        $team = auth()->user()->currentTeam();
        
        $this->subscription = $this->subscriptionService->getSubscriptionDetails($team);
        $this->quotas = $this->quotaService->getQuotaUsage($team);
        $this->availablePlans = collect($this->subscriptionService->getAvailablePlans())
            ->filter(fn($plan) => $plan['name'] !== $team->idem_subscription_plan)
            ->values()
            ->all();
    }

    public function selectPlan($planName)
    {
        $this->selectedPlan = $planName;
        $this->showUpgradeModal = true;
    }

    public function upgradePlan()
    {
        if (!$this->selectedPlan) {
            $this->dispatch('error', 'Veuillez sélectionner un plan');
            return;
        }

        $team = auth()->user()->currentTeam();

        // Le plan gratuit ne se paie pas : on l'applique sur place.
        if ($this->selectedPlan === 'hobby') {
            $result = $this->subscriptionService->changePlan($team, 'hobby');

            if ($result['success']) {
                $this->dispatch('success', $result['message']);
                $this->loadData();
                $this->showUpgradeModal = false;
            } else {
                $this->dispatch('error', $result['message']);
            }

            return null;
        }

        /**
         * Tout ce qui se paie passe par la facturation IDEM.
         *
         * Stripe n'encaisse pas le Mobile Money, qui est le moyen de paiement
         * de nos clients. Et surtout : deux interfaces de paiement, ce sont
         * deux journaux de transactions à rapprocher le jour où un client
         * conteste un débit. Le plan revient ensuite par la synchronisation,
         * une fois le règlement confirmé — jamais avant.
         */
        return redirect()->away($this->idemCheckoutUrl($this->selectedPlan));
    }

    /** Adresse de paiement IDEM pour un plan iDeploy, avec retour sur cette page. */
    private function idemCheckoutUrl(string $planName): string
    {
        $query = http_build_query([
            'product' => 'ideploy-' . $planName,
            'engine' => 'ideploy',
            'app' => 'ideploy',
            'returnUrl' => route('idem.subscription'),
        ]);

        return rtrim(config('idem.dashboard_url'), '/') . '/billing/checkout?' . $query;
    }

    public function cancelSubscription()
    {
        $team = auth()->user()->currentTeam();

        if (config('idem.stripe.enabled') && $team->stripe_subscription_id) {
            $result = $this->stripeService->cancelSubscription($team);
        } else {
            $result = $this->subscriptionService->cancelSubscription($team);
        }

        if ($result['success']) {
            $this->dispatch('success', $result['message']);
            $this->loadData();
        } else {
            $this->dispatch('error', $result['message']);
        }
    }

    public function render()
    {
        return view('livewire.idem.subscription-dashboard');
    }
}
