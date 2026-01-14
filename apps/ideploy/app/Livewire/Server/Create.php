<?php

namespace App\Livewire\Server;

use App\Models\CloudProviderToken;
use App\Models\PrivateKey;
use App\Models\Team;
use App\Services\IdemQuotaService;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class Create extends Component
{
    public $private_keys = [];

    public bool $limit_reached = false;

    public bool $has_hetzner_tokens = false;
    public bool $can_use_cloud_providers = false;

    public function mount()
    {
        $this->private_keys = PrivateKey::ownedByCurrentTeam()->get();
        
        // IDEM: Use IdemQuotaService to check server quota
        // Admins IDEM peuvent ajouter des serveurs sans limite (pour créer serveurs managed)
        $user = Auth::user();
        $isIdemAdmin = $user->idem_role === 'admin';
        $team = $user->currentTeam();
        
        if ($isIdemAdmin) {
            $this->limit_reached = false;
        } else {
            $quotaService = app(IdemQuotaService::class);
            $this->limit_reached = !$quotaService->canAddServer($team);
        }
        
        // IDEM: Vérifier si le plan permet l'utilisation de cloud providers (Hetzner, etc.)
        // Seuls les plans Pro et Enterprise peuvent utiliser les cloud providers
        $allowedPlans = ['pro', 'enterprise'];
        $this->can_use_cloud_providers = $isIdemAdmin || in_array($team->idem_subscription_plan, $allowedPlans);

        // Check if user has Hetzner tokens (et si le plan le permet)
        $this->has_hetzner_tokens = $this->can_use_cloud_providers && CloudProviderToken::ownedByCurrentTeam()
            ->where('provider', 'hetzner')
            ->exists();
    }

    public function render()
    {
        return view('livewire.server.create');
    }
}
