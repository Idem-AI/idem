#\!/usr/bin/env php
<?php
require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\FirewallConfig;
use App\Services\Security\YAMLGeneratorService;
use Symfony\Component\Yaml\Yaml;

// Récupérer la config firewall
$config = FirewallConfig::whereHas('application', function($q) {
    $q->where('name', 'idem-landing');
})->where('enabled', true)->with('rules', 'application')->first();

if (\!$config) {
    echo "No active firewall config found\!\n";
    exit(1);
}

$generator = new YAMLGeneratorService();
$application = $config->application;

echo "Generating YAML files for: {$application->name} ({$application->uuid})\n";
echo "Rules count: " . $config->rules->count() . "\n\n";

// 1. Generate main AppSec config
$appSecConfig = [
    'name' => "ideploy_app_{$application->uuid}",
    'description' => "AppSec configuration for {$application->name}",
    'listen_addr' => '0.0.0.0:7422',
    'inband_rules' => [
        'crowdsecurity/base-config',
        'crowdsecurity/vpatch-*',
        "./custom-rules-{$application->uuid}.yaml"
    ],
    'default_remediation' => 'ban',
    'ban_duration' => '3600s',
    'blocked_http_code' => 403,
    'passed_http_code' => 200
];

$appSecYaml = Yaml::dump($appSecConfig, 6, 2);
echo "Generated appsec-config.yaml:\n";
echo substr($appSecYaml, 0, 200) . "...\n\n";

// 2. Generate custom rules
$customRules = [
    'name' => "custom-rules-{$application->uuid}",
    'description' => "Custom rules for {$application->name}",
    'rules' => []
];

foreach ($config->rules as $rule) {
    $conditions = is_string($rule->conditions) ? json_decode($rule->conditions, true) : $rule->conditions;
    if (\!$conditions) continue;
    
    $yamlRule = [
        'name' => 'custom_' . strtolower(preg_replace('/[^a-zA-Z0-9]+/', '_', $rule->name)),
        'zones' => [],
        'match' => []
    ];
    
    foreach ($conditions as $condition) {
        $zone = $condition['zone'] ?? 'URI';
        if (\!in_array($zone, $yamlRule['zones'])) {
            $yamlRule['zones'][] = $zone;
        }
        
        // Build match condition
        $operator = $condition['operator'] ?? 'match';
        $value = $condition['value'] ?? '';
        
        if ($operator === 'libinjection_sql') {
            $yamlRule['match'] = ['$libinjection_sql'];
        } elseif ($operator === 'libinjection_xss') {
            $yamlRule['match'] = ['$libinjection_xss'];
        } elseif ($operator === 'match' && $value) {
            $yamlRule['match'] = ["regex(\"$value\")"];
        }
    }
    
    if (\!empty($yamlRule['match'])) {
        $customRules['rules'][] = $yamlRule;
    }
}

$customRulesYaml = Yaml::dump($customRules, 6, 2);
echo "Generated custom-rules.yaml:\n";
echo substr($customRulesYaml, 0, 300) . "...\n\n";

// Save to files
$dir = "/tmp/crowdsec-{$application->uuid}";
@mkdir($dir, 0755, true);

file_put_contents("$dir/appsec-config.yaml", $appSecYaml);
file_put_contents("$dir/custom-rules-{$application->uuid}.yaml", $customRulesYaml);

echo "Files saved to: $dir\n";
echo "✅ YAML generation complete\!\n";

// Display command to upload files
echo "\nTo upload files to server:\n";
echo "scp $dir/appsec-config.yaml root@206.81.23.6:/var/lib/coolify/crowdsec/config/appsec-configs/{$application->uuid}/\n";
echo "scp $dir/custom-rules-{$application->uuid}.yaml root@206.81.23.6:/var/lib/coolify/crowdsec/config/appsec-configs/{$application->uuid}/\n";
