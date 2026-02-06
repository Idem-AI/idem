<?php

require __DIR__ . '/apps/ideploy/vendor/autoload.php';
$app = require_once __DIR__ . '/apps/ideploy/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== CROWDSEC STATUS CHECK ===" . PHP_EOL . PHP_EOL;

// Get server
$server = \App\Models\Server::where('ip', '206.81.23.6')->first();
if (!$server) {
    echo "❌ Server not found (206.81.23.6)" . PHP_EOL;
    exit(1);
}

echo "✅ Server: {$server->name} ({$server->ip})" . PHP_EOL;
echo "   UUID: {$server->uuid}" . PHP_EOL;
echo PHP_EOL;

// Check metadata
echo "=== METADATA ===" . PHP_EOL;
$metadata = $server->extra_attributes ?? [];

$fields = [
    'crowdsec_installed',
    'crowdsec_version',
    'crowdsec_bouncer_key',
    'crowdsec_container_name',
    'crowdsec_installed_at',
];

foreach ($fields as $field) {
    if (isset($metadata[$field])) {
        if ($field === 'crowdsec_bouncer_key') {
            echo "✅ {$field}: SET (hidden)" . PHP_EOL;
        } elseif ($field === 'crowdsec_installed') {
            echo ($metadata[$field] ? '✅' : '❌') . " {$field}: " . ($metadata[$field] ? 'true' : 'false') . PHP_EOL;
        } else {
            echo "✅ {$field}: {$metadata[$field]}" . PHP_EOL;
        }
    } else {
        echo "❌ {$field}: NOT SET" . PHP_EOL;
    }
}

echo PHP_EOL;

// Check if container exists on server
echo "=== CHECKING CONTAINER ON SERVER ===" . PHP_EOL;
try {
    $containerName = $metadata['crowdsec_container_name'] ?? 'crowdsec';
    $command = "docker ps -a --filter name={$containerName} --format '{{.Names}}\t{{.Status}}'";
    
    $process = Process::timeout(30)->run("ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i {$server->privateKeyLocation()} root@{$server->ip} \"{$command}\"");
    
    if ($process->exitCode() === 0 && !empty(trim($process->output()))) {
        echo "✅ Container found:" . PHP_EOL;
        echo "   " . trim($process->output()) . PHP_EOL;
    } else {
        echo "❌ Container NOT found on server" . PHP_EOL;
    }
} catch (\Exception $e) {
    echo "❌ Error checking container: " . $e->getMessage() . PHP_EOL;
}

echo PHP_EOL;
echo "=== RECOMMENDATION ===" . PHP_EOL;

if (!isset($metadata['crowdsec_installed']) || !$metadata['crowdsec_installed']) {
    echo "⚠️  CrowdSec NOT installed - Run installation command" . PHP_EOL;
} else {
    echo "✅ Metadata shows installed - Check if container is running" . PHP_EOL;
}
