<?php

require __DIR__ . '/apps/ideploy/vendor/autoload.php';

$app = require_once __DIR__ . '/apps/ideploy/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== TEST FIREWALL RULE CREATION ===" . PHP_EOL;

// Get idem-landing-test application
$application = \App\Models\Application::where('name', 'idem-landing-test')->first();
if (!$application) {
    echo "❌ Application 'idem-landing-test' not found" . PHP_EOL;
    exit(1);
}
echo "✅ Application: {$application->name} ({$application->uuid})" . PHP_EOL;

// Get or create firewall config
$config = \App\Models\FirewallConfig::where('application_id', $application->id)->first();
if (!$config) {
    $config = \App\Models\FirewallConfig::create([
        'application_id' => $application->id,
        'enabled' => true,
        'inband_enabled' => true,
        'outofband_enabled' => true,
        'ban_duration' => 3600,
        'crowdsec_api_key' => 'test_key_' . bin2hex(random_bytes(16)),
    ]);
    echo "✅ Firewall config created" . PHP_EOL;
} else {
    echo "✅ Firewall config exists - Enabled: " . ($config->enabled ? 'YES' : 'NO') . PHP_EOL;
    if (!$config->enabled) {
        $config->enabled = true;
        $config->save();
        echo "✅ Firewall enabled" . PHP_EOL;
    }
}

// Create test rule
echo PHP_EOL . "📝 Creating firewall rule..." . PHP_EOL;
$rule = \App\Models\FirewallRule::create([
    'firewall_config_id' => $config->id,
    'name' => 'Test Block Admin Path ' . time(),
    'description' => 'Block access to /admin paths',
    'enabled' => true,
    'priority' => 100,
    'rule_type' => 'inband',
    'protection_mode' => 'ip_ban',
    'conditions' => [
        ['field' => 'request_path', 'operator' => 'contains', 'value' => '/admin']
    ],
    'logical_operator' => 'AND',
    'action' => 'ban',
    'remediation_duration' => 3600,
]);

echo "✅ Rule created: {$rule->name} (ID: {$rule->id})" . PHP_EOL;
echo PHP_EOL . "🔍 Expected Observer Actions:" . PHP_EOL;
echo "  1. FirewallRuleObserver::saved() triggered" . PHP_EOL;
echo "  2. FirewallRulesDeploymentService::deployRule() called" . PHP_EOL;
echo "  3. YAML uploaded to CrowdSec" . PHP_EOL;
echo "  4. Application redeployment queued (if middlewares missing)" . PHP_EOL;
echo PHP_EOL . "📊 Check Ray logs for details" . PHP_EOL;

// Check queue jobs
echo PHP_EOL . "📋 Checking queue jobs..." . PHP_EOL;
$recentJobs = \App\Models\ApplicationDeploymentQueue::where('application_id', $application->id)
    ->orderBy('created_at', 'desc')
    ->limit(1)
    ->get();

if ($recentJobs->count() > 0) {
    $job = $recentJobs->first();
    echo "✅ Latest deployment: {$job->status} - " . $job->created_at->diffForHumans() . PHP_EOL;
} else {
    echo "⚠️  No recent deployment jobs found" . PHP_EOL;
}
