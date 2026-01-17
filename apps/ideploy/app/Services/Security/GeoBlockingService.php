<?php

namespace App\Services\Security;

use App\Models\FirewallConfig;
use App\Models\FirewallRule;

class GeoBlockingService
{
    /**
     * Get list of countries with flags and codes
     */
    public function getCountries(): array
    {
        return [
            'US' => ['name' => 'United States', 'flag' => '🇺🇸', 'continent' => 'Americas'],
            'GB' => ['name' => 'United Kingdom', 'flag' => '🇬🇧', 'continent' => 'Europe'],
            'FR' => ['name' => 'France', 'flag' => '🇫🇷', 'continent' => 'Europe'],
            'DE' => ['name' => 'Germany', 'flag' => '🇩🇪', 'continent' => 'Europe'],
            'ES' => ['name' => 'Spain', 'flag' => '🇪🇸', 'continent' => 'Europe'],
            'IT' => ['name' => 'Italy', 'flag' => '🇮🇹', 'continent' => 'Europe'],
            'NL' => ['name' => 'Netherlands', 'flag' => '🇳🇱', 'continent' => 'Europe'],
            'BE' => ['name' => 'Belgium', 'flag' => '🇧🇪', 'continent' => 'Europe'],
            'CH' => ['name' => 'Switzerland', 'flag' => '🇨🇭', 'continent' => 'Europe'],
            'CA' => ['name' => 'Canada', 'flag' => '🇨🇦', 'continent' => 'Americas'],
            'CN' => ['name' => 'China', 'flag' => '🇨🇳', 'continent' => 'Asia'],
            'RU' => ['name' => 'Russia', 'flag' => '🇷🇺', 'continent' => 'Europe'],
            'IN' => ['name' => 'India', 'flag' => '🇮🇳', 'continent' => 'Asia'],
            'BR' => ['name' => 'Brazil', 'flag' => '🇧🇷', 'continent' => 'Americas'],
            'JP' => ['name' => 'Japan', 'flag' => '🇯🇵', 'continent' => 'Asia'],
            'KR' => ['name' => 'South Korea', 'flag' => '🇰🇷', 'continent' => 'Asia'],
            'AU' => ['name' => 'Australia', 'flag' => '🇦🇺', 'continent' => 'Oceania'],
            'MX' => ['name' => 'Mexico', 'flag' => '🇲🇽', 'continent' => 'Americas'],
            'AR' => ['name' => 'Argentina', 'flag' => '🇦🇷', 'continent' => 'Americas'],
            'ZA' => ['name' => 'South Africa', 'flag' => '🇿🇦', 'continent' => 'Africa'],
            'NG' => ['name' => 'Nigeria', 'flag' => '🇳🇬', 'continent' => 'Africa'],
            'EG' => ['name' => 'Egypt', 'flag' => '🇪🇬', 'continent' => 'Africa'],
            'TR' => ['name' => 'Turkey', 'flag' => '🇹🇷', 'continent' => 'Asia'],
            'SA' => ['name' => 'Saudi Arabia', 'flag' => '🇸🇦', 'continent' => 'Asia'],
            'AE' => ['name' => 'United Arab Emirates', 'flag' => '🇦🇪', 'continent' => 'Asia'],
            'SG' => ['name' => 'Singapore', 'flag' => '🇸🇬', 'continent' => 'Asia'],
            'MY' => ['name' => 'Malaysia', 'flag' => '🇲🇾', 'continent' => 'Asia'],
            'TH' => ['name' => 'Thailand', 'flag' => '🇹🇭', 'continent' => 'Asia'],
            'VN' => ['name' => 'Vietnam', 'flag' => '🇻🇳', 'continent' => 'Asia'],
            'PH' => ['name' => 'Philippines', 'flag' => '🇵🇭', 'continent' => 'Asia'],
            'ID' => ['name' => 'Indonesia', 'flag' => '🇮🇩', 'continent' => 'Asia'],
            'PK' => ['name' => 'Pakistan', 'flag' => '🇵🇰', 'continent' => 'Asia'],
            'BD' => ['name' => 'Bangladesh', 'flag' => '🇧🇩', 'continent' => 'Asia'],
            'PL' => ['name' => 'Poland', 'flag' => '🇵🇱', 'continent' => 'Europe'],
            'UA' => ['name' => 'Ukraine', 'flag' => '🇺🇦', 'continent' => 'Europe'],
            'RO' => ['name' => 'Romania', 'flag' => '🇷🇴', 'continent' => 'Europe'],
            'CZ' => ['name' => 'Czech Republic', 'flag' => '🇨🇿', 'continent' => 'Europe'],
            'SE' => ['name' => 'Sweden', 'flag' => '🇸🇪', 'continent' => 'Europe'],
            'NO' => ['name' => 'Norway', 'flag' => '🇳🇴', 'continent' => 'Europe'],
            'DK' => ['name' => 'Denmark', 'flag' => '🇩🇰', 'continent' => 'Europe'],
            'FI' => ['name' => 'Finland', 'flag' => '🇫🇮', 'continent' => 'Europe'],
            'PT' => ['name' => 'Portugal', 'flag' => '🇵🇹', 'continent' => 'Europe'],
            'GR' => ['name' => 'Greece', 'flag' => '🇬🇷', 'continent' => 'Europe'],
            'AT' => ['name' => 'Austria', 'flag' => '🇦🇹', 'continent' => 'Europe'],
            'HU' => ['name' => 'Hungary', 'flag' => '🇭🇺', 'continent' => 'Europe'],
            'IE' => ['name' => 'Ireland', 'flag' => '🇮🇪', 'continent' => 'Europe'],
            'NZ' => ['name' => 'New Zealand', 'flag' => '🇳🇿', 'continent' => 'Oceania'],
            'CL' => ['name' => 'Chile', 'flag' => '🇨🇱', 'continent' => 'Americas'],
            'CO' => ['name' => 'Colombia', 'flag' => '🇨🇴', 'continent' => 'Americas'],
            'PE' => ['name' => 'Peru', 'flag' => '🇵🇪', 'continent' => 'Americas'],
            'VE' => ['name' => 'Venezuela', 'flag' => '🇻🇪', 'continent' => 'Americas'],
        ];
    }
    
    /**
     * Get countries grouped by continent
     */
    public function getCountriesByContinent(): array
    {
        $countries = $this->getCountries();
        $grouped = [];
        
        foreach ($countries as $code => $data) {
            $continent = $data['continent'];
            if (!isset($grouped[$continent])) {
                $grouped[$continent] = [];
            }
            $grouped[$continent][$code] = $data;
        }
        
        // Sort continents
        ksort($grouped);
        
        return $grouped;
    }
    
    /**
     * Get commonly blocked countries
     */
    public function getHighRiskCountries(): array
    {
        return [
            'CN' => 'China - High bot traffic',
            'RU' => 'Russia - High attack rate',
            'KP' => 'North Korea - Security threat',
            'IR' => 'Iran - High risk',
            'VN' => 'Vietnam - High spam rate',
        ];
    }
    
    /**
     * Create whitelist rule
     */
    public function createWhitelistRule(FirewallConfig $config, array $countryCodes, ?string $name = null): FirewallRule
    {
        $countries = $this->getCountries();
        $countryNames = array_map(fn($code) => $countries[$code]['name'] ?? $code, $countryCodes);
        
        return FirewallRule::create([
            'firewall_config_id' => $config->id,
            'name' => $name ?? 'Geo-Blocking: Allow ' . implode(', ', array_slice($countryNames, 0, 3)) . (count($countryNames) > 3 ? '...' : ''),
            'description' => 'Allow traffic only from: ' . implode(', ', $countryNames),
            'conditions' => [
                [
                    'field' => 'country_code',
                    'operator' => 'in',
                    'value' => implode(',', $countryCodes),
                ]
            ],
            'action' => 'allow',
            'priority' => 10, // High priority
            'enabled' => true,
            'inband' => true,
            'outofband' => false,
        ]);
    }
    
    /**
     * Create blacklist rule
     */
    public function createBlacklistRule(FirewallConfig $config, array $countryCodes, ?string $name = null): FirewallRule
    {
        $countries = $this->getCountries();
        $countryNames = array_map(fn($code) => $countries[$code]['name'] ?? $code, $countryCodes);
        
        return FirewallRule::create([
            'firewall_config_id' => $config->id,
            'name' => $name ?? 'Geo-Blocking: Block ' . implode(', ', array_slice($countryNames, 0, 3)) . (count($countryNames) > 3 ? '...' : ''),
            'description' => 'Block traffic from: ' . implode(', ', $countryNames),
            'conditions' => [
                [
                    'field' => 'country_code',
                    'operator' => 'in',
                    'value' => implode(',', $countryCodes),
                ]
            ],
            'action' => 'block',
            'priority' => 10, // High priority
            'enabled' => true,
            'inband' => true,
            'outofband' => false,
        ]);
    }
    
    /**
     * Get suggested whitelist (common business countries)
     */
    public function getSuggestedWhitelist(): array
    {
        return [
            'US', 'GB', 'FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'CH', 
            'CA', 'AU', 'JP', 'SG', 'IE', 'SE', 'NO', 'DK', 'FI'
        ];
    }
    
    /**
     * Get suggested blacklist (high-risk countries)
     */
    public function getSuggestedBlacklist(): array
    {
        return ['CN', 'RU', 'KP', 'IR'];
    }
}
