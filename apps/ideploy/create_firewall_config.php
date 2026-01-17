#\!/usr/bin/env php
<?php
require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Application;
use App\Models\FirewallConfig;
use App\Models\FirewallRule;

// Trouver l'application idem-landing
$app = Application::where('name', 'idem-landing')->first();

if (\!$app) {
    echo "Application idem-landing not found\!\n";
    exit(1);
}

echo "Found application: {$app->name} (UUID: {$app->uuid})\n";

// Créer ou récupérer la config firewall
$config = FirewallConfig::firstOrCreate(
    ['application_id' => $app->id],
    [
        'enabled' => true,
        'mode' => 'blocking',
        'inband_mode' => 'blocking',
        'crowdsec_api_key' => \Str::random(45),
        'crowdsec_bouncer_key' => \Str::random(45),
    ]
);

echo "Firewall config created/found with ID: {$config->id}\n";

// Créer quelques règles de base
$rules = [
    [
        'name' => 'Block SQL Injection',
        'description' => 'Detect and block SQL injection attempts',
        'conditions' => json_encode([
            ['zone' => 'ARGS', 'operator' => 'libinjection_sql', 'value' => '']
        ]),
        'action' => 'ban',
        'priority' => 100,
        'enabled' => true,
    ],
    [
        'name' => 'Block XSS Attempts',
        'description' => 'Detect and block XSS injection attempts',
        'conditions' => json_encode([
            ['zone' => 'ARGS', 'operator' => 'libinjection_xss', 'value' => '']
        ]),
        'action' => 'ban',
        'priority' => 90,
        'enabled' => true,
    ],
    [
        'name' => 'Block Known Bots',
        'description' => 'Block malicious bots and crawlers',
        'conditions' => json_encode([
            ['zone' => 'HEADERS:User-Agent', 'operator' => 'match', 'value' => '(bot|crawler|spider|scraper)']
        ]),
        'action' => 'ban',
        'priority' => 80,
        'enabled' => true,
    ],
];

foreach ($rules as $ruleData) {
    $rule = FirewallRule::firstOrCreate(
        [
            'firewall_config_id' => $config->id,
            'name' => $ruleData['name'],
        ],
        $ruleData
    );
    echo "Created rule: {$rule->name}\n";
}

echo "\n✅ Firewall configuration complete\!\n";
echo "Config ID: {$config->id}\n";
echo "Application: {$app->name}\n";
echo "Rules created: " . count($rules) . "\n";
