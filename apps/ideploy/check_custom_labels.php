#!/usr/bin/env php
<?php

require '/var/www/html/vendor/autoload.php';

$app = require_once '/var/www/html/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Application;

$application = Application::find(8);
$customLabels = base64_decode($application->custom_labels);

echo "📋 STORED CUSTOM LABELS\n";
echo "=======================\n\n";

$lines = explode("\n", $customLabels);
echo "Total lines: " . count($lines) . "\n\n";

echo "Lines with crowdsec or appsec:\n";
$found = false;
foreach ($lines as $line) {
    if (stripos($line, 'crowdsec') !== false || stripos($line, 'appsec') !== false) {
        echo "  {$line}\n";
        $found = true;
    }
}

if (!$found) {
    echo "  ❌ NONE FOUND\n";
}

echo "\nMiddleware line:\n";
foreach ($lines as $line) {
    if (str_contains($line, '.middlewares=')) {
        echo "  {$line}\n";
    }
}

echo "\n";
echo "is_container_label_readonly_enabled: " . ($application->settings->is_container_label_readonly_enabled ? 'TRUE' : 'FALSE') . "\n";
