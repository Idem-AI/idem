<?php

namespace App\Services;

use App\Models\Server;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Service de scheduling intelligent des serveurs
 * 
 * Algorithme de sélection basé sur:
 * 1. Géolocalisation (proximité avec le pays de l'utilisateur)
 * 2. Disponibilité (serveur actif et non saturé)
 * 3. Charge actuelle (nombre d'applications déployées)
 * 4. Ressources disponibles (CPU, RAM, Disk)
 */
class ServerSchedulingService
{
    /**
     * Mapping des pays africains vers leurs régions
     */
    private const AFRICAN_REGIONS = [
        // West Africa
        'SN' => ['region' => 'West Africa', 'name' => 'Senegal'],
        'CI' => ['region' => 'West Africa', 'name' => 'Côte d\'Ivoire'],
        'GH' => ['region' => 'West Africa', 'name' => 'Ghana'],
        'NG' => ['region' => 'West Africa', 'name' => 'Nigeria'],
        'BJ' => ['region' => 'West Africa', 'name' => 'Benin'],
        'TG' => ['region' => 'West Africa', 'name' => 'Togo'],
        'BF' => ['region' => 'West Africa', 'name' => 'Burkina Faso'],
        'ML' => ['region' => 'West Africa', 'name' => 'Mali'],
        'NE' => ['region' => 'West Africa', 'name' => 'Niger'],
        'GN' => ['region' => 'West Africa', 'name' => 'Guinea'],
        'SL' => ['region' => 'West Africa', 'name' => 'Sierra Leone'],
        'LR' => ['region' => 'West Africa', 'name' => 'Liberia'],
        'GM' => ['region' => 'West Africa', 'name' => 'Gambia'],
        'GW' => ['region' => 'West Africa', 'name' => 'Guinea-Bissau'],
        'MR' => ['region' => 'West Africa', 'name' => 'Mauritania'],
        
        // Central Africa
        'CM' => ['region' => 'Central Africa', 'name' => 'Cameroon'],
        'GA' => ['region' => 'Central Africa', 'name' => 'Gabon'],
        'CG' => ['region' => 'Central Africa', 'name' => 'Congo'],
        'CD' => ['region' => 'Central Africa', 'name' => 'DR Congo'],
        'CF' => ['region' => 'Central Africa', 'name' => 'Central African Republic'],
        'TD' => ['region' => 'Central Africa', 'name' => 'Chad'],
        'GQ' => ['region' => 'Central Africa', 'name' => 'Equatorial Guinea'],
        'ST' => ['region' => 'Central Africa', 'name' => 'São Tomé and Príncipe'],
        
        // East Africa
        'KE' => ['region' => 'East Africa', 'name' => 'Kenya'],
        'TZ' => ['region' => 'East Africa', 'name' => 'Tanzania'],
        'UG' => ['region' => 'East Africa', 'name' => 'Uganda'],
        'RW' => ['region' => 'East Africa', 'name' => 'Rwanda'],
        'BI' => ['region' => 'East Africa', 'name' => 'Burundi'],
        'ET' => ['region' => 'East Africa', 'name' => 'Ethiopia'],
        'SO' => ['region' => 'East Africa', 'name' => 'Somalia'],
        'DJ' => ['region' => 'East Africa', 'name' => 'Djibouti'],
        'ER' => ['region' => 'East Africa', 'name' => 'Eritrea'],
        'SS' => ['region' => 'East Africa', 'name' => 'South Sudan'],
        
        // Southern Africa
        'ZA' => ['region' => 'Southern Africa', 'name' => 'South Africa'],
        'NA' => ['region' => 'Southern Africa', 'name' => 'Namibia'],
        'BW' => ['region' => 'Southern Africa', 'name' => 'Botswana'],
        'ZW' => ['region' => 'Southern Africa', 'name' => 'Zimbabwe'],
        'ZM' => ['region' => 'Southern Africa', 'name' => 'Zambia'],
        'MW' => ['region' => 'Southern Africa', 'name' => 'Malawi'],
        'MZ' => ['region' => 'Southern Africa', 'name' => 'Mozambique'],
        'AO' => ['region' => 'Southern Africa', 'name' => 'Angola'],
        'LS' => ['region' => 'Southern Africa', 'name' => 'Lesotho'],
        'SZ' => ['region' => 'Southern Africa', 'name' => 'Eswatini'],
        
        // North Africa
        'EG' => ['region' => 'North Africa', 'name' => 'Egypt'],
        'LY' => ['region' => 'North Africa', 'name' => 'Libya'],
        'TN' => ['region' => 'North Africa', 'name' => 'Tunisia'],
        'DZ' => ['region' => 'North Africa', 'name' => 'Algeria'],
        'MA' => ['region' => 'North Africa', 'name' => 'Morocco'],
        'SD' => ['region' => 'North Africa', 'name' => 'Sudan'],
    ];

    /**
     * Obtenir la liste des pays africains pour le dropdown
     */
    public static function getAfricanCountries(): array
    {
        $countries = [];
        foreach (self::AFRICAN_REGIONS as $code => $data) {
            $countries[] = [
                'code' => $code,
                'name' => $data['name'],
                'region' => $data['region'],
            ];
        }
        
        // Trier par nom
        usort($countries, fn($a, $b) => strcmp($a['name'], $b['name']));
        
        return $countries;
    }

    /**
     * Obtenir la région d'un pays
     */
    public static function getRegionForCountry(string $countryCode): ?string
    {
        return self::AFRICAN_REGIONS[strtoupper($countryCode)]['region'] ?? null;
    }

    /**
     * Sélectionner le meilleur serveur pour un déploiement
     * 
     * @param string|null $userCountryCode Code pays de l'utilisateur (ex: "CM")
     * @param array $requirements Exigences de l'application (ram, cpu, etc.)
     * @return Server|null
     */
    public function selectBestServer(?string $userCountryCode = null, array $requirements = []): ?Server
    {
        // Récupérer tous les serveurs managés et disponibles
        $servers = Server::managed()
            ->where('is_available', true)
            ->whereRaw('current_applications < max_applications')
            ->get();

        if ($servers->isEmpty()) {
            Log::warning('Aucun serveur disponible pour le déploiement');
            return null;
        }

        // Si pas de pays spécifié, utiliser l'algorithme simple
        if (!$userCountryCode) {
            return $this->selectByLoad($servers);
        }

        // Calculer le score pour chaque serveur
        $scoredServers = $servers->map(function ($server) use ($userCountryCode, $requirements) {
            $score = $this->calculateServerScore($server, $userCountryCode, $requirements);
            return [
                'server' => $server,
                'score' => $score,
            ];
        });

        // Trier par score décroissant
        $scoredServers = $scoredServers->sortByDesc('score');

        // Retourner le serveur avec le meilleur score
        $best = $scoredServers->first();
        
        if ($best) {
            Log::info('Serveur sélectionné', [
                'server_id' => $best['server']->id,
                'server_name' => $best['server']->name,
                'score' => $best['score'],
                'country' => $best['server']->country,
                'region' => $best['server']->region,
            ]);
            
            return $best['server'];
        }

        return null;
    }

    /**
     * Calculer le score d'un serveur
     * 
     * Score basé sur:
     * - Proximité géographique (40 points)
     * - Charge actuelle (30 points)
     * - Ressources disponibles (30 points)
     */
    private function calculateServerScore(Server $server, string $userCountryCode, array $requirements): int
    {
        $score = 0;

        // 1. Score de proximité géographique (40 points max)
        $score += $this->calculateProximityScore($server, $userCountryCode);

        // 2. Score de charge (30 points max)
        $score += $this->calculateLoadScore($server);

        // 3. Score de ressources (30 points max)
        $score += $this->calculateResourceScore($server, $requirements);

        return $score;
    }

    /**
     * Score de proximité géographique
     */
    private function calculateProximityScore(Server $server, string $userCountryCode): int
    {
        $userRegion = self::getRegionForCountry($userCountryCode);
        
        if (!$userRegion || !$server->region) {
            return 0; // Pas d'info géographique
        }

        // Même pays = 40 points
        if ($server->country_code === strtoupper($userCountryCode)) {
            return 40;
        }

        // Même région = 30 points
        if ($server->region === $userRegion) {
            return 30;
        }

        // Continent africain mais région différente = 10 points
        return 10;
    }

    /**
     * Score de charge (inversement proportionnel à la charge)
     */
    private function calculateLoadScore(Server $server): int
    {
        if ($server->max_applications <= 0) {
            return 0;
        }

        // Calculer le pourcentage de charge
        $loadPercentage = ($server->current_applications / $server->max_applications) * 100;

        // Inverser: moins de charge = meilleur score
        // 0% charge = 30 points, 100% charge = 0 points
        return (int) (30 * (1 - ($loadPercentage / 100)));
    }

    /**
     * Score de ressources disponibles
     */
    private function calculateResourceScore(Server $server, array $requirements): int
    {
        $score = 30; // Score de base

        // Vérifier si le serveur a les ressources nécessaires
        if (isset($requirements['ram_mb']) && $server->ram_mb) {
            if ($server->ram_mb < $requirements['ram_mb']) {
                $score -= 15; // Pénalité si RAM insuffisante
            }
        }

        if (isset($requirements['cpu_cores']) && $server->cpu_cores) {
            if ($server->cpu_cores < $requirements['cpu_cores']) {
                $score -= 15; // Pénalité si CPU insuffisant
            }
        }

        return max(0, $score);
    }

    /**
     * Sélection simple par charge (fallback)
     */
    private function selectByLoad(Collection $servers): ?Server
    {
        return $servers->sortBy(function ($server) {
            if ($server->max_applications <= 0) {
                return PHP_INT_MAX;
            }
            return $server->current_applications / $server->max_applications;
        })->first();
    }

    /**
     * Mettre à jour le compteur d'applications d'un serveur
     */
    public function incrementApplicationCount(Server $server): void
    {
        $server->increment('current_applications');
        $this->updateLoadScore($server);
    }

    /**
     * Décrémenter le compteur d'applications d'un serveur
     */
    public function decrementApplicationCount(Server $server): void
    {
        $server->decrement('current_applications');
        $this->updateLoadScore($server);
    }

    /**
     * Mettre à jour le score de charge d'un serveur
     */
    private function updateLoadScore(Server $server): void
    {
        if ($server->max_applications <= 0) {
            $server->update(['load_score' => 0]);
            return;
        }

        $loadPercentage = ($server->current_applications / $server->max_applications) * 100;
        $server->update(['load_score' => (int) $loadPercentage]);
    }

    /**
     * Obtenir les statistiques des serveurs par région
     */
    public function getServerStatsByRegion(): array
    {
        $servers = Server::managed()->get();
        
        $stats = [];
        foreach ($servers as $server) {
            $region = $server->region ?? 'Unknown';
            
            if (!isset($stats[$region])) {
                $stats[$region] = [
                    'total' => 0,
                    'available' => 0,
                    'applications' => 0,
                    'capacity' => 0,
                ];
            }
            
            $stats[$region]['total']++;
            if ($server->is_available) {
                $stats[$region]['available']++;
            }
            $stats[$region]['applications'] += $server->current_applications;
            $stats[$region]['capacity'] += $server->max_applications;
        }
        
        return $stats;
    }
}
