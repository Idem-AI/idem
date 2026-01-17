<?php

require_once '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Application;
use App\Models\FirewallTrafficLog;

echo "🔍 VÉRIFICATION DES LOGS CAPTURÉS\n";
echo "═════════════════════════════════════════\n\n";

$application = Application::where('name', 'idem-ai')->first();

if (!$application) {
    echo "❌ Application non trouvée\n";
    exit(1);
}

echo "📱 Application: {$application->name}\n";
echo "   UUID: {$application->uuid}\n\n";

$totalLogs = FirewallTrafficLog::where('application_id', $application->id)->count();

echo "📊 Total logs dans la DB: {$totalLogs}\n\n";

if ($totalLogs > 0) {
    echo "✅✅✅ LOGS CAPTURÉS ! LE SYSTÈME FONCTIONNE !\n\n";
    
    // Afficher les derniers logs
    echo "📝 Derniers 10 logs:\n";
    echo "─────────────────────────────────────────\n";
    
    $logs = FirewallTrafficLog::where('application_id', $application->id)
        ->orderBy('timestamp', 'desc')
        ->take(10)
        ->get(['ip_address', 'method', 'uri', 'decision', 'timestamp']);
    
    foreach ($logs as $log) {
        $time = $log->timestamp->format('H:i:s');
        $ip = str_pad($log->ip_address, 15);
        $method = str_pad($log->method, 4);
        $uri = str_pad(substr($log->uri, 0, 20), 20);
        echo "{$time} | {$ip} | {$method} {$uri} | {$log->decision}\n";
    }
    
    echo "\n";
    
    // Stats par décision
    $allowed = FirewallTrafficLog::where('application_id', $application->id)
        ->where('decision', 'allow')->count();
    $blocked = FirewallTrafficLog::where('application_id', $application->id)
        ->where('decision', 'ban')->count();
    
    echo "📈 Statistiques:\n";
    echo "   Allowed: {$allowed}\n";
    echo "   Blocked: {$blocked}\n";
    echo "   Total: {$totalLogs}\n";
    
} else {
    echo "⚠️  Aucun log trouvé pour le moment\n\n";
    echo "💡 Raisons possibles:\n";
    echo "   1. Les webhooks CrowdSec n'ont pas encore été déclenchés\n";
    echo "   2. CrowdSec n'a pas analysé ces requêtes (trop simples)\n";
    echo "   3. Le webhook est configuré mais pas actif dans profiles.yaml\n";
}
