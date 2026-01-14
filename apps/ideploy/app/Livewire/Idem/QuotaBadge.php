<?php

namespace App\Livewire\Idem;

use App\Services\IdemQuotaService;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class QuotaBadge extends Component
{
    public string $type = 'apps'; // 'apps' or 'servers'
    public bool $showDetails = false;
    public bool $compact = false;

    protected $listeners = ['quotaUpdated' => '$refresh'];

    public function render()
    {
        $user = Auth::user();
        $isIdemAdmin = $user->idem_role === 'admin';
        
        $quotaService = app(IdemQuotaService::class);
        $team = $user->currentTeam();
        $quotas = $quotaService->getQuotaUsage($team);
        
        $quota = $quotas[$this->type] ?? [
            'used' => 0,
            'limit' => 0,
            'unlimited' => false,
            'percentage' => 0
        ];
        
        // Override pour les admins IDEM: afficher comme illimité
        if ($isIdemAdmin && $this->type === 'servers') {
            $quota['unlimited'] = true;
            $quota['limit'] = -1;
        }

        return view('livewire.idem.quota-badge', [
            'quota' => $quota,
            'quotas' => $quotas,
        ]);
    }
}
