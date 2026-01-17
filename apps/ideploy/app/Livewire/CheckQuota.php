<?php

namespace App\Livewire;

use Livewire\Component;
use App\Services\IdemQuotaService;

class CheckQuota extends Component
{
    public $quotaType; // 'app' or 'server'
    public $canProceed = null;
    public $message = '';
    public $suggestedPlan = '';
    public $currentUsage = '';
    public $limit = '';

    public function mount($type)
    {
        $this->quotaType = $type;
        $this->checkQuota();
    }

    public function checkQuota()
    {
        $team = auth()->user()->currentTeam();
        
        if (!$team) {
            $this->canProceed = false;
            $this->message = 'No team found';
            return;
        }

        $quotaService = app(IdemQuotaService::class);

        if ($this->quotaType === 'app') {
            $this->canProceed = $quotaService->canDeployApp($team);
            $usage = $quotaService->getQuotaUsage($team);
            
            $this->currentUsage = $usage['apps']['used'];
            $this->limit = $usage['apps']['unlimited'] ? 'unlimited' : $usage['apps']['limit'];
            
            if (!$this->canProceed) {
                $this->message = "Application limit reached ({$this->currentUsage}/{$this->limit})";
                $this->suggestedPlan = $this->getSuggestedPlan($team->idem_app_limit);
            }
        } 
        elseif ($this->quotaType === 'server') {
            $this->canProceed = $quotaService->canAddServer($team);
            $usage = $quotaService->getQuotaUsage($team);
            
            $this->currentUsage = $usage['servers']['used'];
            $this->limit = $usage['servers']['unlimited'] ? 'unlimited' : $usage['servers']['limit'];
            
            if (!$this->canProceed) {
                if ($team->idem_server_limit === 0) {
                    $this->message = "Your {$team->idem_subscription_plan} plan doesn't allow personal servers";
                } else {
                    $this->message = "Server limit reached ({$this->currentUsage}/{$this->limit})";
                }
                $this->suggestedPlan = $this->getSuggestedPlan($team->idem_server_limit, true);
            }
        }
    }

    private function getSuggestedPlan($currentLimit, $isServer = false)
    {
        if ($isServer) {
            if ($currentLimit < 2) return 'Basic';
            if ($currentLimit < 10) return 'Pro';
            return 'Enterprise';
        } else {
            if ($currentLimit < 10) return 'Basic';
            if ($currentLimit < 50) return 'Pro';
            return 'Enterprise';
        }
    }

    public function render()
    {
        return view('livewire.check-quota');
    }
}
