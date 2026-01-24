<?php

namespace App\Services;

use App\Models\Server;
use App\Models\Team;
use Illuminate\Support\Collection;

class IdemServerService
{
    /**
     * Server selection strategies
     */
    const STRATEGY_LEAST_LOADED = 'least_loaded';
    const STRATEGY_ROUND_ROBIN = 'round_robin';
    const STRATEGY_RANDOM = 'random';

    /**
     * Get all IDEM managed servers
     */
    public function getManagedServers(): Collection
    {
        return Server::where('idem_managed', true)
            ->where('team_id', 0) // Root team owns managed servers
            ->get();
    }

    /**
     * Get available IDEM managed servers for deployment
     */
    public function getAvailableServers(): Collection
    {
        return Server::where('idem_managed', true)
            ->where('team_id', 0)
            ->whereHas('settings', function ($query) {
                $query->where('is_usable', true)
                      ->where('is_reachable', true);
            })
            ->get();
    }

    /**
     * Select best server for deployment based on strategy
     */
    public function selectBestServer(string $strategy = self::STRATEGY_LEAST_LOADED): ?Server
    {
        $availableServers = $this->getAvailableServers();

        if ($availableServers->isEmpty()) {
            return null;
        }

        return match ($strategy) {
            self::STRATEGY_LEAST_LOADED => $this->selectLeastLoadedServer($availableServers),
            self::STRATEGY_ROUND_ROBIN => $this->selectRoundRobinServer($availableServers),
            self::STRATEGY_RANDOM => $this->selectRandomServer($availableServers),
            default => $this->selectLeastLoadedServer($availableServers),
        };
    }

    /**
     * Select server with least load
     */
    private function selectLeastLoadedServer(Collection $servers): ?Server
    {
        return $servers->sortBy('idem_load_score')->first();
    }

    /**
     * Select server using round-robin (by ID for simplicity)
     */
    private function selectRoundRobinServer(Collection $servers): ?Server
    {
        // Simple round-robin based on server IDs
        $lastUsed = cache()->get('idem_last_server_id', 0);
        
        // Get next server after last used
        $nextServer = $servers->where('id', '>', $lastUsed)->sortBy('id')->first();
        
        // If no next server, start from beginning
        if (!$nextServer) {
            $nextServer = $servers->sortBy('id')->first();
        }

        if ($nextServer) {
            cache()->put('idem_last_server_id', $nextServer->id, 3600);
        }

        return $nextServer;
    }

    /**
     * Select random server
     */
    private function selectRandomServer(Collection $servers): ?Server
    {
        return $servers->random();
    }

    /**
     * Update server load score
     */
    public function updateServerLoad(Server $server): void
    {
        // Count applications on this server
        $appsCount = $server->applications()->count();
        $servicesCount = $server->services()->count();
        $databasesCount = $server->databases()->count();
        
        // Calculate load score (simple count for now, can be more sophisticated)
        $loadScore = $appsCount + $servicesCount + $databasesCount;

        $server->update(['idem_load_score' => $loadScore]);
    }

    /**
     * Get servers visible to a team (excludes IDEM managed servers for non-admins)
     */
    public function getVisibleServers(Team $team): Collection
    {
        return Server::where('team_id', $team->id)
            ->where('idem_managed', false)
            ->get();
    }

    /**
     * Get all servers for admin (including managed servers with full details)
     */
    public function getAdminServers(): Collection
    {
        return Server::with('settings', 'team')->get();
    }

    /**
     * Get managed server statistics
     */
    public function getManagedServerStats(): array
    {
        $servers = $this->getManagedServers();
        
        $totalServers = $servers->count();
        $onlineServers = $servers->filter(function ($server) {
            return $server->settings->is_reachable ?? false;
        })->count();

        $totalApps = 0;
        $totalDatabases = 0;
        $averageLoad = 0;

        foreach ($servers as $server) {
            $totalApps += $server->applications()->count();
            $totalDatabases += $server->databases()->count();
            $averageLoad += $server->idem_load_score;
        }

        if ($totalServers > 0) {
            $averageLoad = round($averageLoad / $totalServers, 2);
        }

        return [
            'total_servers' => $totalServers,
            'online_servers' => $onlineServers,
            'offline_servers' => $totalServers - $onlineServers,
            'total_applications' => $totalApps,
            'total_databases' => $totalDatabases,
            'average_load' => $averageLoad,
        ];
    }

    /**
     * Create a new IDEM managed server
     */
    public function createManagedServer(array $data): Server
    {
        $data['team_id'] = 0; // Root team
        $data['idem_managed'] = true;
        $data['idem_load_score'] = 0;

        return Server::create($data);
    }

    /**
     * Check if a server should be hidden from client
     */
    public function shouldHideFromClient(Server $server, Team $team): bool
    {
        // Hide if it's a managed server and team doesn't own it
        return $server->idem_managed && $server->team_id !== $team->id;
    }

    /**
     * Get sanitized server data for clients (hides sensitive info)
     */
    public function getSanitizedServerData(Server $server): array
    {
        return [
            'id' => $server->id,
            'uuid' => $server->uuid,
            'name' => $server->name,
            'description' => $server->description,
            // Hide IP, user, port, and other sensitive info
            'is_reachable' => $server->settings->is_reachable ?? false,
            'proxy_type' => $server->proxy_type,
        ];
    }
}
