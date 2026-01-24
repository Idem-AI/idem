<?php

namespace App\Livewire\Idem;

use App\Services\IdemSubscriptionService;
use App\Services\IdemQuotaService;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class SubscriptionBanner extends Component
{
    public bool $dismissible = true;
    public bool $showUpgradePrompt = false;

    public function mount()
    {
        $team = Auth::user()->currentTeam();
        $quotaService = app(IdemQuotaService::class);
        $quotas = $quotaService->getQuotaUsage($team);
        
        // Show upgrade prompt if any quota above 80%
        $this->showUpgradePrompt = $quotas['apps']['percentage'] >= 80 || 
                                   $quotas['servers']['percentage'] >= 80;
    }

    public function dismiss()
    {
        $this->showUpgradePrompt = false;
        session(['idem_banner_dismissed' => true]);
    }

    public function render()
    {
        $subscriptionService = app(IdemSubscriptionService::class);
        $team = Auth::user()->currentTeam();
        
        $subscription = $subscriptionService->getSubscriptionDetails($team);
        $plan = $subscription['plan'];

        return view('livewire.idem.subscription-banner', [
            'subscription' => $subscription,
            'plan' => $plan,
        ]);
    }
}
