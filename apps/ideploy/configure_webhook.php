<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Server;
use Illuminate\Support\Facades\Storage;

echo "=== Configuring CrowdSec Webhook for Traffic Logging ===" . PHP_EOL . PHP_EOL;

$server = Server::find(1);

if (!$server) {
    echo "❌ Server not found!" . PHP_EOL;
    exit(1);
}

echo "Server: {$server->name}" . PHP_EOL;
echo "IP: {$server->ip}" . PHP_EOL . PHP_EOL;

// Check if already configured
$check = instant_remote_process([
    'grep -q "ideploy_webhook" /var/lib/coolify/crowdsec/config/notifications/http.yaml && echo "EXISTS" || echo "NOT_FOUND"'
], $server);

if (trim($check) === 'EXISTS') {
    echo "✅ Webhook already configured!" . PHP_EOL . PHP_EOL;
    
    $content = instant_remote_process([
        'cat /var/lib/coolify/crowdsec/config/notifications/http.yaml'
    ], $server);
    
    echo "Current config:" . PHP_EOL . $content . PHP_EOL;
    exit(0);
}

echo "❌ Webhook NOT configured. Configuring now..." . PHP_EOL . PHP_EOL;

// Get config
$appUrl = config('app.url');
$webhookToken = config('crowdsec.webhook_token');

if (!$webhookToken) {
    echo "❌ CROWDSEC_WEBHOOK_TOKEN not set in .env!" . PHP_EOL;
    echo "Please add: CROWDSEC_WEBHOOK_TOKEN=your_token_here" . PHP_EOL;
    exit(1);
}

echo "App URL: {$appUrl}" . PHP_EOL;
echo "Token: " . substr($webhookToken, 0, 10) . "..." . PHP_EOL . PHP_EOL;

// Generate webhook YAML
$yaml = <<<YAML
name: ideploy_webhook
type: http
log_level: info

format: |
  {
    "application_uuid": "{{ .Source.Labels.application_uuid }}",
    "ip_address": "{{ .Source.IP }}",
    "method": "{{ .Source.Labels.http_method }}",
    "uri": "{{ .Source.Labels.http_path }}",
    "user_agent": "{{ .Source.Labels.http_user_agent }}",
    "decision": "{{ .Alert.Remediation }}",
    "rule_name": "{{ .Source.Scope }}:{{ .Source.Value }}",
    "country": "{{ .Source.Range }}",
    "asn": "{{ .Source.AS }}"
  }

url: {$appUrl}/api/crowdsec/traffic-log
method: POST

headers:
  Content-Type: application/json
  X-CrowdSec-Token: "{$webhookToken}"

filter: |
  true
YAML;

// Write to temp file
$tempPath = storage_path('app/crowdsec-webhook-config.yaml');
file_put_contents($tempPath, $yaml);

echo "📤 Uploading webhook config to server..." . PHP_EOL;

instant_scp(
    $tempPath,
    '/var/lib/coolify/crowdsec/config/notifications/http.yaml',
    $server
);

echo "✅ Webhook config uploaded" . PHP_EOL . PHP_EOL;

// Update profiles to enable notification
echo "📝 Updating profiles.yaml to enable notifications..." . PHP_EOL;

$profilesYaml = <<<YAML
name: default_ip_remediation
filters:
  - Alert.Remediation == true && Alert.GetScope() == "Ip"
decisions:
  - type: ban
    duration: 4h
notifications:
  - ideploy_webhook
on_success: break
YAML;

file_put_contents($tempPath, $profilesYaml);

instant_scp(
    $tempPath,
    '/var/lib/coolify/crowdsec/config/profiles.yaml',
    $server
);

echo "✅ Profiles updated" . PHP_EOL . PHP_EOL;

// Reload CrowdSec
echo "🔄 Reloading CrowdSec..." . PHP_EOL;

instant_remote_process([
    'docker exec crowdsec kill -SIGHUP 1'
], $server);

echo "✅ CrowdSec reloaded" . PHP_EOL . PHP_EOL;

// Cleanup
unlink($tempPath);

// Verify
echo "=== Verification ===" . PHP_EOL . PHP_EOL;

$content = instant_remote_process([
    'cat /var/lib/coolify/crowdsec/config/notifications/http.yaml'
], $server);

echo "Webhook config:" . PHP_EOL . $content . PHP_EOL . PHP_EOL;

echo "=== Testing Webhook Endpoint ===" . PHP_EOL . PHP_EOL;

$testUrl = $appUrl . '/api/crowdsec/health';
echo "Testing: {$testUrl}" . PHP_EOL;

try {
    $ch = curl_init($testUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        echo "✅ Webhook endpoint is accessible!" . PHP_EOL;
        echo "Response: " . $response . PHP_EOL;
    } else {
        echo "⚠️  Webhook endpoint returned HTTP {$httpCode}" . PHP_EOL;
    }
} catch (\Exception $e) {
    echo "⚠️  Could not test webhook endpoint: " . $e->getMessage() . PHP_EOL;
}

echo PHP_EOL;
echo "✅ Configuration complete!" . PHP_EOL . PHP_EOL;

echo "Webhook will now send traffic events to:" . PHP_EOL;
echo "  → {$appUrl}/api/crowdsec/traffic-log" . PHP_EOL . PHP_EOL;

echo "Events will be logged in table: firewall_traffic_logs" . PHP_EOL;
