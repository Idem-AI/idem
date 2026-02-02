<?php

require __DIR__ . '/apps/ideploy/vendor/autoload.php';
$app = require_once __DIR__ . '/apps/ideploy/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== TEST COMPLET FIREWALL ===" . PHP_EOL . PHP_EOL;

// 1. Get application
$application = \App\Models\Application::where('name', 'idem-landing-test')->first();
if (!$application) {
    echo "❌ Application not found" . PHP_EOL;
    exit(1);
}
echo "✅ Application: {$application->name} ({$application->uuid})" . PHP_EOL;

// 2. Get/Create firewall config
$config = \App\Models\FirewallConfig::firstOrCreate(
    ['application_id' => $application->id],
    [
        'enabled' => true,
        'inband_enabled' => true,
        'outofband_enabled' => true,
        'ban_duration' => 3600,
        'crowdsec_api_key' => 'test_' . bin2hex(random_bytes(16)),
    ]
);

if (!$config->enabled) {
    $config->update(['enabled' => true]);
}
echo "✅ Firewall enabled" . PHP_EOL . PHP_EOL;

// 3. Clean old test rules
echo "🧹 Cleaning old test rules..." . PHP_EOL;
$deleted = \App\Models\FirewallRule::where('firewall_config_id', $config->id)
    ->where('name', 'LIKE', 'TEST%')
    ->delete();
echo "   Deleted: {$deleted} old test rules" . PHP_EOL . PHP_EOL;

// 4. Create test rule
echo "📝 Creating test rule..." . PHP_EOL;
$service = app(\App\Services\Security\FirewallRuleService::class);
$rule = $service->createRule($config, [
    'name' => 'TEST Block Test Path',
    'description' => 'Test rule for validation',
    'enabled' => true,
    'priority' => 100,
    'rule_type' => 'inband',
    'protection_mode' => 'ip_ban',
    'conditions' => [
        ['field' => 'request_path', 'operator' => 'equals', 'value' => '/test-blocked']
    ],
    'logical_operator' => 'AND',
    'action' => 'ban',
    'remediation_duration' => 3600,
]);
echo "✅ Rule created: ID {$rule->id} - {$rule->name}" . PHP_EOL . PHP_EOL;

// 5. Wait for observer
echo "⏳ Waiting 3s for Observer..." . PHP_EOL;
sleep(3);

// 6. Check deployment queue
echo "🔍 Checking deployment queue..." . PHP_EOL;
$job = \App\Models\ApplicationDeploymentQueue::where('application_id', $application->id)
    ->latest()
    ->first();

if ($job) {
    echo "✅ Deployment job found!" . PHP_EOL;
    echo "   - ID: {$job->id}" . PHP_EOL;
    echo "   - Status: {$job->status}" . PHP_EOL;
    echo "   - Created: {$job->created_at->diffForHumans()}" . PHP_EOL;
} else {
    echo "❌ NO DEPLOYMENT JOB FOUND!" . PHP_EOL;
    echo "   Observer may not have triggered" . PHP_EOL;
}

echo PHP_EOL . "🔍 Check Ray logs for Observer execution traces" . PHP_EOL;
