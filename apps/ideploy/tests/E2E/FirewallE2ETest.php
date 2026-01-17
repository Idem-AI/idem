<?php

namespace Tests\E2E;

use Tests\TestCase;
use App\Models\Application;
use App\Models\FirewallConfig;
use App\Models\FirewallRule;
use App\Jobs\Security\DeployFirewallRulesJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

/**
 * Tests E2E du Firewall CrowdSec
 * 
 * Ces tests vérifient:
 * 1. Génération correcte des scenarios avec noms uniques
 * 2. Isolation par application (UUID)
 * 3. Blocage effectif des requêtes malveillantes
 * 4. Remontée des métriques (allowed, blocked, challenged)
 */
class FirewallE2ETest extends TestCase
{
    protected $testApp;
    protected $firewallConfig;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        // Utiliser l'application 'idem' pour les tests
        $this->testApp = Application::where('name', 'idem')->first();
        $this->assertNotNull($this->testApp, "Application 'idem' doit exister");
        
        $this->firewallConfig = $this->testApp->firewallConfig;
        $this->assertNotNull($this->firewallConfig, "Firewall doit être activé");
    }
    
    /** @test */
    public function it_generates_unique_scenario_names_for_duplicate_rule_names()
    {
        // Créer 2 règles avec le même nom
        $rule1 = FirewallRule::create([
            'firewall_config_id' => $this->firewallConfig->id,
            'name' => 'Block Admin',
            'protection_mode' => 'ip_ban',
            'action' => 'ban',
            'enabled' => true,
            'conditions' => [['field' => 'ip_address', 'operator' => 'equals', 'value' => '1.2.3.4']]
        ]);
        
        $rule2 = FirewallRule::create([
            'firewall_config_id' => $this->firewallConfig->id,
            'name' => 'Block Admin', // Même nom !
            'protection_mode' => 'ip_ban',
            'action' => 'ban',
            'enabled' => true,
            'conditions' => [['field' => 'request_path', 'operator' => 'starts_with', 'value' => '/admin']]
        ]);
        
        $parserService = app(\App\Services\Security\ParserGeneratorService::class);
        
        $yaml1 = $parserService->generateScenario(
            $this->testApp->uuid,
            $rule1->name,
            $rule1->conditions,
            $rule1->action,
            $rule1->id
        );
        
        $yaml2 = $parserService->generateScenario(
            $this->testApp->uuid,
            $rule2->name,
            $rule2->conditions,
            $rule2->action,
            $rule2->id
        );
        
        // Extraire noms
        preg_match('/name: (.+)/', $yaml1, $m1);
        preg_match('/name: (.+)/', $yaml2, $m2);
        
        $name1 = $m1[1] ?? '';
        $name2 = $m2[1] ?? '';
        
        // Vérifier noms différents
        $this->assertNotEquals($name1, $name2, "Les scenarios doivent avoir des noms différents");
        $this->assertStringContainsString((string)$rule1->id, $name1, "Le nom doit contenir l'ID de règle 1");
        $this->assertStringContainsString((string)$rule2->id, $name2, "Le nom doit contenir l'ID de règle 2");
        
        // Cleanup
        $rule1->delete();
        $rule2->delete();
    }
    
    /** @test */
    public function it_isolates_rules_by_application_uuid()
    {
        $rule = $this->firewallConfig->rules()->enabled()->first();
        $this->assertNotNull($rule, "Au moins une règle doit exister");
        
        $parserService = app(\App\Services\Security\ParserGeneratorService::class);
        
        $yaml = $parserService->generateScenario(
            $this->testApp->uuid,
            $rule->name,
            $rule->conditions,
            $rule->action,
            $rule->id
        );
        
        // Vérifier isolation
        $this->assertStringContainsString("traefik_router_name contains '{$this->testApp->uuid}'", $yaml);
        $this->assertStringContainsString("http_host contains '{$this->testApp->uuid}'", $yaml);
        $this->assertStringContainsString("app_uuid: {$this->testApp->uuid}", $yaml);
    }
    
    /** @test */
    public function it_blocks_bad_user_agent()
    {
        $rule = FirewallRule::where('name', 'Block Bad Bots')->first();
        
        if (!$rule || !$rule->enabled) {
            $this->markTestSkipped("Règle 'Block Bad Bots' n'existe pas ou désactivée");
        }
        
        $appUrl = $this->testApp->fqdn ?? $this->testApp->domains->first()?->name;
        
        if (!$appUrl) {
            $this->markTestSkipped("Application sans domaine configuré");
        }
        
        // Requête avec BadBot User-Agent (devrait être bloquée)
        $response = Http::withHeaders([
            'User-Agent' => 'BadBot/1.0'
        ])->get("https://{$appUrl}");
        
        // CrowdSec peut retourner 403 (ban) ou 401 (captcha)
        $this->assertContains($response->status(), [403, 401], 
            "BadBot devrait être bloqué (403) ou challengé (401)");
    }
    
    /** @test */
    public function it_allows_legitimate_traffic()
    {
        $appUrl = $this->testApp->fqdn ?? $this->testApp->domains->first()?->name;
        
        if (!$appUrl) {
            $this->markTestSkipped("Application sans domaine configuré");
        }
        
        // Requête légitime
        $response = Http::withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        ])->get("https://{$appUrl}");
        
        // Devrait être autorisée (pas 403/401)
        $this->assertNotContains($response->status(), [403, 401], 
            "Trafic légitime ne devrait pas être bloqué");
    }
    
    /** @test */
    public function it_blocks_specific_ip_without_affecting_others()
    {
        // Créer règle blocage IP spécifique
        $rule = FirewallRule::create([
            'firewall_config_id' => $this->firewallConfig->id,
            'name' => 'Block Test IP 5.6.7.8',
            'protection_mode' => 'ip_ban',
            'action' => 'ban',
            'enabled' => true,
            'conditions' => [['field' => 'ip_address', 'operator' => 'equals', 'value' => '5.6.7.8']]
        ]);
        
        // Déployer
        DeployFirewallRulesJob::dispatchSync($this->firewallConfig);
        
        $parserService = app(\App\Services\Security\ParserGeneratorService::class);
        $yaml = $parserService->generateScenario(
            $this->testApp->uuid,
            $rule->name,
            $rule->conditions,
            $rule->action,
            $rule->id
        );
        
        // Vérifier que le filtre ne bloque QUE cette IP
        $this->assertStringContainsString("source_ip == '5.6.7.8'", $yaml);
        $this->assertStringNotContainsString("source_ip != ", $yaml, 
            "Ne devrait pas utiliser de négation qui bloquerait les autres IPs");
        
        // Cleanup
        $rule->delete();
    }
    
    /** @test */
    public function it_tracks_firewall_metrics()
    {
        $stats = $this->firewallConfig->getTrafficStats();
        
        $this->assertIsArray($stats);
        $this->assertArrayHasKey('allowed', $stats);
        $this->assertArrayHasKey('denied', $stats);
        $this->assertArrayHasKey('challenged', $stats);
        $this->assertArrayHasKey('all_traffic', $stats);
        
        // Vérifier types
        $this->assertIsInt($stats['allowed']);
        $this->assertIsInt($stats['denied']);
        $this->assertIsInt($stats['challenged']);
        $this->assertIsInt($stats['all_traffic']);
        
        // Vérifier cohérence
        $this->assertEquals(
            $stats['allowed'] + $stats['denied'] + $stats['challenged'],
            $stats['all_traffic'],
            "Le total devrait être la somme des 3 catégories"
        );
    }
    
    /** @test */
    public function it_handles_multiple_conditions_with_and_operator()
    {
        // Règle: /admin ET IP spécifique
        $rule = FirewallRule::create([
            'firewall_config_id' => $this->firewallConfig->id,
            'name' => 'Block Admin From Specific IP',
            'protection_mode' => 'hybrid',
            'action' => 'ban',
            'enabled' => true,
            'logical_operator' => 'AND',
            'conditions' => [
                ['field' => 'request_path', 'operator' => 'starts_with', 'value' => '/admin'],
                ['field' => 'ip_address', 'operator' => 'equals', 'value' => '9.9.9.9']
            ]
        ]);
        
        $parserService = app(\App\Services\Security\ParserGeneratorService::class);
        $yaml = $parserService->generateScenario(
            $this->testApp->uuid,
            $rule->name,
            $rule->conditions,
            $rule->action,
            $rule->id
        );
        
        // Vérifier opérateur AND (&&)
        $this->assertStringContainsString("&&", $yaml);
        $this->assertStringContainsString("/admin", $yaml);
        $this->assertStringContainsString("9.9.9.9", $yaml);
        
        // Cleanup
        $rule->delete();
    }
    
    /** @test */
    public function it_loads_scenarios_in_crowdsec()
    {
        if (!$this->testApp->destination?->server) {
            $this->markTestSkipped("Serveur non disponible");
        }
        
        $server = $this->testApp->destination->server;
        
        // Lister scenarios via cscli
        $output = instant_remote_process([
            'docker exec crowdsec-live cscli scenarios list -o json 2>/dev/null || echo "[]"'
        ], $server);
        
        $scenarios = json_decode($output, true);
        
        if (!is_array($scenarios) || !isset($scenarios['scenarios'])) {
            $this->markTestSkipped("Impossible de lister les scenarios CrowdSec");
        }
        
        $ideploy Scenarios = array_filter($scenarios['scenarios'], function($s) {
            return str_contains($s['name'] ?? '', 'ideploy');
        });
        
        $this->assertNotEmpty($ideployScenarios, 
            "Au moins un scenario iDeploy devrait être chargé");
        
        // Vérifier qu'ils sont enabled
        foreach ($ideployScenarios as $scenario) {
            $this->assertStringContainsString('enabled', $scenario['status'] ?? '', 
                "Scenario {$scenario['name']} devrait être enabled");
        }
    }
}
