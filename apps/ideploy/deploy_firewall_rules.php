#\!/usr/bin/env php
<?php
require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\FirewallConfig;
use App\Jobs\Security\DeployFirewallRulesJob;

// Récupérer la config firewall pour idem-landing
$config = FirewallConfig::whereHas('application', function($q) {
    $q->where('name', 'idem-landing');
})->where('enabled', true)->first();

if ($config) {
    echo "Deploying firewall rules for application: {$config->application->name}\n";
    echo "Config ID: {$config->id}\n";
    echo "Rules count: " . $config->rules()->count() . "\n";
    
    // Dispatch le job
    DeployFirewallRulesJob::dispatch($config);
    
    echo "✅ Job dispatched successfully\!\n";
} else {
    echo "❌ No active firewall config found for idem-landing\!\n";
}
