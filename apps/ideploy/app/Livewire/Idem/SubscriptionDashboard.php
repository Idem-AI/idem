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

        // Check if Stripe is enabled
        if (config('idem.stripe.enabled')) {
            // Create checkout session
            $result = $this->stripeService->createCheckoutSession($team, $this->selectedPlan);
            
            if ($result['success']) {
                // Redirect to Stripe checkout via JavaScript
                $this->dispatch('redirect-to-stripe', url: $result['checkout_url']);
                return;
            } else {
                $this->dispatch('error', $result['message']);
            }
        } else {
            // Direct plan change (no payment)
            $result = $this->subscriptionService->changePlan($team, $this->selectedPlan);
            
            if ($result['success']) {
                $this->dispatch('success', $result['message']);
                $this->loadData();
                $this->showUpgradeModal = false;
            } else {
                $this->dispatch('error', $result['message']);
            }
        }
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
