<?php

namespace App\Livewire\Project\Application\Security;

use App\Models\Application;
use App\Models\FirewallConfig;
use App\Services\Security\FirewallConfigService;
use App\Services\Security\BotManagementTemplateService;
use App\Services\Security\GeoBlockingService;
use Livewire\Component;

class FirewallOverview extends Component
{
    public Application $application;
    public ?FirewallConfig $config = null;
    
    public $parameters;
    
    public $firewallEnabled = false;
    public $crowdSecAvailable = false;
    public $showInstallModal = false;
    public $installing = false;
    public $botProtectionEnabled = false;
    public $customRulesCount = 0;
    public $activating = false;
    public $pollCount = 0;
    
    // Bot Management Modal
    public $showBotManagementModal = false;
    public $botTemplates = [];
    public $selectedTemplate = null;
    
    // Rate Limiting
    public $showRateLimitModal = false;
    public $rateLimitTemplates = [];
    public $rateLimitEnabled = false;
    
    // Geo-Blocking
    public $showGeoBlockingModal = false;
    public $geoBlockingMode = 'blacklist'; // whitelist or blacklist
    public $selectedCountries = [];
    public $availableCountries = [];
    
    // Stats
    public $stats = [
        'all_traffic' => 0,
        'allowed' => 0,
        'denied' => 0,
        'challenged' => 0,
    ];
    
    public $hourlyTrafficData = [];
    public $activeAlerts = [];
    public $recentEvents = [];
    public $activeRules = [];
    public $trafficLoggingEnabled = false;
    
    public $timeRange = '24h'; // 1h, 24h, 7d, 30d
    
    public function mount()
    {
        $project = currentTeam()
            ->projects()
            ->where('uuid', request()->route('project_uuid'))
            ->firstOrFail();
        $environment = $project->environments()
            ->where('uuid', request()->route('environment_uuid'))
            ->firstOrFail();
        $this->application = $environment->applications()
            ->where('uuid', request()->route('application_uuid'))
            ->firstOrFail();
            
        $this->parameters = [
            'project_uuid' => $project->uuid,
            'environment_uuid' => $environment->uuid,
            'application_uuid' => $this->application->uuid,
        ];
        
        // Check if CrowdSec is available on server
        $server = $this->application->destination->server;
        $this->crowdSecAvailable = $server->crowdsec_available ?? false;
        
        $this->loadData();
    }
    
    public function loadData()
    {
        // Load or create firewall config
        $configService = app(FirewallConfigService::class);
        $this->config = $configService->getOrCreateConfig($this->application);
        
        $this->firewallEnabled = $this->config->enabled;
        $this->updateBotProtectionStatus();
        $this->customRulesCount = $this->config->rules()->count();
        
        // Load active rules (always show, even without traffic)
        $this->activeRules = $this->config->rules()
            ->enabled()
            ->ordered()
            ->get()
            ->map(fn($rule) => [
                'id' => $rule->id,
                'name' => $rule->name,
                'action' => $rule->action,
                'conditions_count' => count($rule->conditions),
                'match_count' => $rule->match_count,
                'last_match_at' => $rule->last_match_at?->diffForHumans(),
            ])
            ->toArray();
        
        // Check if traffic logging is enabled
        // Consider it enabled if:
        // 1. Webhook token is configured
        // 2. OR there are logs in the database (proof it's working)
        $webhookToken = config('crowdsec.webhook_token');
        $hasLogs = $this->config && $this->config->trafficLogs()->exists();
        
        $this->trafficLoggingEnabled = !empty($webhookToken) || $hasLogs;
        
        if (!$this->crowdSecAvailable) {
            // CrowdSec not available, show install prompt
            return;
        }
        
        if (!$this->firewallEnabled) {
            // Firewall disabled, show zero stats
            $this->stats = [
                'all_traffic' => 0,
                'allowed' => 0,
                'denied' => 0,
                'challenged' => 0,
            ];
            return;
        }
        
        // Load REAL traffic metrics from Traefik access logs (cached 2 min)
        $traefikCacheKey = "traefik_metrics_{$this->application->id}";
        $traefikMetrics = \Cache::remember($traefikCacheKey, now()->addMinutes(2), function() {
            $traefikService = app(\App\Services\Security\TraefikAccessLogService::class);
            return $traefikService->getMetrics($this->application, 24);
        });
        
        // Load CrowdSec metrics for blocked traffic details
        $cacheKey = "firewall_metrics_{$this->config->id}";
        $crowdsecMetrics = \Cache::remember($cacheKey, now()->addMinutes(5), function() {
            $metricsService = app(\App\Services\Security\CrowdSecMetricsService::class);
            return $metricsService->getMetrics($this->config);
        });
        
        // Combine metrics: Traefik for total/allowed, CrowdSec for denied details
        $this->stats = [
            'all_traffic' => $traefikMetrics['total_requests'],
            'allowed' => $traefikMetrics['total_allowed'],
            'denied' => $traefikMetrics['total_denied'],
            'challenged' => 0, // TODO: implement captcha tracking
        ];
        
        // Load hourly data from Traefik (real traffic)
        $this->hourlyTrafficData = $traefikMetrics['hourly_data'];
        
        // Load recent events from Traefik (real traffic)
        $this->recentEvents = collect($traefikMetrics['recent_events'])
            ->map(fn($event) => [
                'ip' => $event['ip'],
                'reason' => $event['method'] . ' ' . $event['path'] . ' (' . $event['status'] . ')',
                'action' => $event['action'],
                'timestamp' => $event['timestamp'],
            ])
            ->toArray();
        
        // Dispatch background job to refresh metrics
        dispatch(new \App\Jobs\Security\RefreshFirewallMetricsJob($this->config));
        
        // Load active alerts
        $this->activeAlerts = $this->config->alerts()
            ->active()
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn($alert) => [
                'id' => $alert->id,
                'type' => $alert->alert_type,
                'severity' => $alert->severity,
                'ip' => $alert->ip_address,
                'message' => $alert->message,
                'time' => $alert->created_at->diffForHumans(),
            ])
            ->toArray();
    }
    
    public function toggleFirewall()
    {
        if (!$this->crowdSecAvailable) {
            $this->showInstallModal = true;
            return;
        }
        
        $configService = app(FirewallConfigService::class);
        
        try {
            if ($this->firewallEnabled) {
                // Disable firewall
                $configService->disableFirewall($this->config);
                $this->dispatch('success', 'Firewall disabled successfully');
            } else {
                // Enable firewall
                $configService->enableFirewall($this->application);
                $this->dispatch('success', 'Firewall enabled successfully');
            }
            
            $this->loadData();
            
        } catch (\Exception $e) {
            $this->dispatch('error', 'Failed to toggle firewall: ' . $e->getMessage());
            ray('Firewall toggle error: ' . $e->getMessage());
        }
    }
    
    public function syncAlerts()
    {
        try {
            // Dispatch sync job
            dispatch(new \App\Jobs\Security\SyncCrowdSecAlertsJob());
            
            // Wait a moment then reload data
            $this->dispatch('success', 'Syncing alerts from CrowdSec...');
            
            // Reload data after a short delay
            sleep(2);
            $this->loadData();
            
            ray('✅ Alerts sync triggered');
            
        } catch (\Exception $e) {
            $this->dispatch('error', 'Failed to sync alerts: ' . $e->getMessage());
            ray('❌ Sync alerts error: ' . $e->getMessage());
        }
    }
    
    public function activateFirewall()
    {
        $server = $this->application->destination->server;
        
        ray("🔥 Activating firewall for app: {$this->application->name}");
        ray("Server: {$server->name} (ID: {$server->id})");
        ray("CrowdSec installed: " . ($server->crowdsec_installed ? 'YES' : 'NO'));
        ray("CrowdSec available: " . ($server->crowdsec_available ? 'YES' : 'NO'));
        
        // Si CrowdSec n'est pas disponible, afficher erreur
        if (!$server->crowdsec_installed || !$server->crowdsec_available) {
            ray('❌ CrowdSec not available on this server');
            $this->dispatch('error', 'CrowdSec is not installed on this server. Please wait for server setup to complete or install CrowdSec manually.');
            return;
        }
        
        // CrowdSec est disponible, activer directement
        ray("✅ CrowdSec is ready, activating firewall...");
        
        try {
            $configService = app(FirewallConfigService::class);
            $configService->enableFirewall($this->application);
            $this->loadData();
            $this->dispatch('success', 'Firewall activated successfully!');
            ray('✅ Firewall activated for app');
            
        } catch (\Exception $e) {
            ray('❌ Failed to activate firewall: ' . $e->getMessage());
            $this->dispatch('error', 'Failed to activate firewall: ' . $e->getMessage());
        }
    }
    
    public function refreshData()
    {
        $this->loadData();
        $this->dispatch('success', 'Data refreshed');
    }
    
    public function changeTimeRange($range)
    {
        $this->timeRange = $range;
        // TODO: Filter stats by time range
        $this->loadData();
    }
    
    public function toggleBotProtection()
    {
        if (!$this->firewallEnabled) {
            $this->dispatch('error', 'Please enable firewall first');
            return;
        }
        
        try {
            $this->config->update([
                'bot_protection_enabled' => !$this->botProtectionEnabled
            ]);
            
            $this->botProtectionEnabled = !$this->botProtectionEnabled;
            
            $this->dispatch('success', 'Bot protection ' . ($this->botProtectionEnabled ? 'enabled' : 'disabled'));
            
        } catch (\Exception $e) {
            $this->dispatch('error', 'Failed to toggle bot protection: ' . $e->getMessage());
        }
    }
    
    public function checkActivationStatus()
    {
        // Cette méthode est appelée par le polling pour vérifier l'état d'activation
        $server = $this->application->destination->server;
        
        // Rafraîchir les données du serveur depuis la DB
        $server->refresh();
        
        // Mettre à jour le status CrowdSec
        $this->crowdSecAvailable = $server->crowdsec_installed && $server->crowdsec_available;
        
        // Si en cours d'activation, incrémenter le compteur
        if ($this->activating) {
            $this->pollCount++;
            
            // Debug tous les 10 polls (30 secondes)
            if ($this->pollCount % 10 === 0) {
                ray("Checking activation status (poll {$this->pollCount}):");
                ray("  - crowdsec_installed: " . ($server->crowdsec_installed ? 'YES' : 'NO'));
                ray("  - crowdsec_available: " . ($server->crowdsec_available ? 'YES' : 'NO'));
            }
            
            // Si CrowdSec est disponible, arrêter l'activation
            if ($this->crowdSecAvailable) {
                ray('✅ CrowdSec is now available! Enabling firewall...');
                $this->activating = false;
                $this->pollCount = 0;
                
                // Auto-enable firewall
                try {
                    $configService = app(FirewallConfigService::class);
                    $configService->enableFirewall($this->application);
                    $this->loadData();
                    $this->dispatch('success', 'Firewall activated successfully!');
                } catch (\Exception $e) {
                    ray('❌ Auto-enable failed: ' . $e->getMessage());
                    $this->dispatch('error', 'Failed to enable firewall: ' . $e->getMessage());
                }
            }
            
            // Timeout après 5 minutes (100 polls)
            if ($this->pollCount > 100) {
                ray('⏱️ Activation timeout reached');
                $this->activating = false;
                $this->pollCount = 0;
                $this->dispatch('error', 'Firewall activation timeout. Please check server status.');
            }
        }
        
        // Rafraîchir les données si le firewall est activé
        if ($this->firewallEnabled && !$this->activating) {
            $this->loadData();
        }
    }
    
    /**
     * Open Bot Management modal
     */
    public function openBotManagement()
    {
        if (!$this->config) {
            $this->dispatch('error', 'Please enable firewall first');
            return;
        }
        
        $templateService = app(BotManagementTemplateService::class);
        $this->botTemplates = $templateService->getTemplates();
        $this->showBotManagementModal = true;
        
        ray('🤖 Bot Management modal opened with ' . count($this->botTemplates) . ' templates');
    }
    
    /**
     * Close Bot Management modal
     */
    public function closeBotManagement()
    {
        $this->showBotManagementModal = false;
        $this->selectedTemplate = null;
    }
    
    /**
     * Import bot template and create rule
     */
    public function importBotTemplate(string $templateKey)
    {
        try {
            if (!$this->config) {
                throw new \Exception('Firewall config not found');
            }
            
            $templateService = app(BotManagementTemplateService::class);
            $rule = $templateService->importTemplate($templateKey, $this->config);
            
            ray("✅ Bot template '{$templateKey}' imported successfully");
            
            $this->loadData();
            $this->closeBotManagement();
            $this->dispatch('success', "Bot protection rule '{$rule->name}' created successfully!");
            
        } catch (\Exception $e) {
            ray("❌ Failed to import template: {$e->getMessage()}");
            $this->dispatch('error', 'Failed to import template: ' . $e->getMessage());
        }
    }
    
    /**
     * Open Protection Patterns modal
     */
    public function openRateLimit()
    {
        $templateService = app(\App\Services\Security\RateLimitTemplateService::class);
        $this->rateLimitTemplates = $templateService->getTemplates();
        $this->showRateLimitModal = true;
        
        ray('🛡️ Protection Patterns modal opened with ' . count($this->rateLimitTemplates) . ' templates');
    }
    
    /**
     * Close Protection Patterns modal
     */
    public function closeRateLimit()
    {
        $this->showRateLimitModal = false;
    }
    
    /**
     * Import protection pattern template and create rule
     */
    public function importRateLimitTemplate(string $templateKey)
    {
        try {
            if (!$this->config) {
                throw new \Exception('Firewall config not found');
            }
            
            $templateService = app(\App\Services\Security\RateLimitTemplateService::class);
            $rule = $templateService->importTemplate($templateKey, $this->config);
            
            ray("✅ Protection pattern '{$templateKey}' imported successfully");
            
            $this->loadData();
            $this->closeRateLimit();
            $this->dispatch('success', "Protection pattern '{$rule->name}' created successfully!");
            
        } catch (\Exception $e) {
            ray("❌ Failed to import template: {$e->getMessage()}");
            $this->dispatch('error', 'Failed to import template: ' . $e->getMessage());
        }
    }
    
    /**
     * Open Geo-Blocking modal
     */
    public function openGeoBlocking()
    {
        $geoService = app(GeoBlockingService::class);
        $this->availableCountries = $geoService->getCountriesByContinent();
        $this->selectedCountries = [];
        $this->showGeoBlockingModal = true;
        
        ray('🌍 Geo-Blocking modal opened');
    }
    
    /**
     * Close Geo-Blocking modal
     */
    public function closeGeoBlocking()
    {
        $this->showGeoBlockingModal = false;
        $this->selectedCountries = [];
    }
    
    /**
     * Toggle country selection
     */
    public function toggleCountry($countryCode)
    {
        if (in_array($countryCode, $this->selectedCountries)) {
            $this->selectedCountries = array_values(array_diff($this->selectedCountries, [$countryCode]));
        } else {
            $this->selectedCountries[] = $countryCode;
        }
    }
    
    /**
     * Apply suggested countries
     */
    public function applySuggestedCountries($type)
    {
        $geoService = app(GeoBlockingService::class);
        
        if ($type === 'whitelist') {
            $this->selectedCountries = $geoService->getSuggestedWhitelist();
            $this->geoBlockingMode = 'whitelist';
        } else {
            $this->selectedCountries = $geoService->getSuggestedBlacklist();
            $this->geoBlockingMode = 'blacklist';
        }
    }
    
    /**
     * Create geo-blocking rule
     */
    public function createGeoBlockingRule()
    {
        try {
            if (!$this->config) {
                throw new \Exception('Firewall config not found');
            }
            
            if (empty($this->selectedCountries)) {
                $this->dispatch('error', 'Please select at least one country');
                return;
            }
            
            $geoService = app(GeoBlockingService::class);
            
            if ($this->geoBlockingMode === 'whitelist') {
                $rule = $geoService->createWhitelistRule($this->config, $this->selectedCountries);
                $message = 'Whitelist rule created: Only ' . count($this->selectedCountries) . ' countries allowed';
            } else {
                $rule = $geoService->createBlacklistRule($this->config, $this->selectedCountries);
                $message = 'Blacklist rule created: ' . count($this->selectedCountries) . ' countries blocked';
            }
            
            ray("✅ Geo-blocking rule created: {$rule->name}");
            
            $this->loadData();
            $this->closeGeoBlocking();
            $this->dispatch('success', $message);
            
        } catch (\Exception $e) {
            ray("❌ Failed to create geo-blocking rule: {$e->getMessage()}");
            $this->dispatch('error', 'Failed to create rule: ' . $e->getMessage());
        }
    }
    
    /**
     * Get hourly traffic data for chart (last 24h)
     */
    private function getHourlyTrafficData(): array
    {
        if (!$this->config) {
            return [];
        }
        
        $logs = $this->config->trafficLogs()
            ->whereBetween('timestamp', [now()->subHours(24), now()])
            ->get();
        
        $hourlyData = [];
        for ($i = 23; $i >= 0; $i--) {
            $hour = now()->subHours($i)->format('H:00');
            $hourlyData[$hour] = ['allowed' => 0, 'denied' => 0, 'challenged' => 0];
        }
        
        foreach ($logs as $log) {
            $hour = $log->timestamp->format('H:00');
            if (isset($hourlyData[$hour])) {
                if ($log->decision === 'ban') {
                    $hourlyData[$hour]['denied']++;
                } elseif ($log->decision === 'captcha') {
                    $hourlyData[$hour]['challenged']++;
                } else {
                    $hourlyData[$hour]['allowed']++;
                }
            }
        }
        
        return $hourlyData;
    }
    
    /**
     * Check if bot protection is enabled
     */
    private function updateBotProtectionStatus(): void
    {
        if (!$this->config) {
            $this->botProtectionEnabled = false;
            return;
        }
        
        // Check if any bot-related rules exist (case-insensitive)
        $botRuleExists = $this->config->rules()
            ->enabled()
            ->where(function($query) {
                $query->whereRaw('LOWER(name) LIKE ?', ['%bot%'])
                      ->orWhereRaw('LOWER(name) LIKE ?', ['%crawler%'])
                      ->orWhereRaw('LOWER(name) LIKE ?', ['%scraper%']);
            })
            ->exists();
        
        $this->botProtectionEnabled = $botRuleExists;
        
        ray("Bot protection status: " . ($botRuleExists ? 'ACTIVE' : 'INACTIVE'));
    }
    
    public function render()
    {
        return view('livewire.project.application.security.firewall-overview');
    }
}
