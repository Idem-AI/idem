#\!/usr/bin/env php
<?php
require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Application;
use App\Models\Server;

// Trouver l'application
$app = Application::where('name', 'idem-landing')->first();
$server = Server::where('ip', '206.81.23.6')->first();

if (\!$app || \!$server) {
    echo "Application or server not found\!\n";
    exit(1);
}

echo "Configuring ForwardAuth for: {$app->name}\n";
echo "Container UUID: {$app->uuid}\n";
echo "Server: {$server->name} ({$server->ip})\n\n";

// Commandes pour ajouter les labels ForwardAuth
$commands = [
    // Arrêter le container actuel
    "docker stop {$app->uuid}-101602366253",
    
    // Redémarrer avec les labels ForwardAuth
    "docker rm {$app->uuid}-101602366253",
    
    // Recréer avec labels Traefik ForwardAuth
    'docker run -d --name ' . $app->uuid . '-forwardauth ' .
    '--network coolify ' .
    '--restart unless-stopped ' .
    '--label "traefik.enable=true" ' .
    '--label "traefik.docker.network=coolify" ' .
    '--label "traefik.http.routers.' . $app->uuid . '.rule=Host(\`' . $app->uuid . '.206.81.23.6.sslip.io\`)" ' .
    '--label "traefik.http.routers.' . $app->uuid . '.middlewares=' . $app->uuid . '-forwardauth" ' .
    '--label "traefik.http.middlewares.' . $app->uuid . '-forwardauth.forwardauth.address=http://traffic-logger:8080/forwardauth" ' .
    '--label "traefik.http.middlewares.' . $app->uuid . '-forwardauth.forwardauth.trustForwardHeader=true" ' .
    '--label "traefik.http.services.' . $app->uuid . '.loadbalancer.server.port=80" ' .
    'ghcr.io/huggingface/text-generation-inference:2.0',
];

echo "Commands to execute:\n";
foreach ($commands as $cmd) {
    echo "  $cmd\n";
}

echo "\nExecute? (yes/no): ";
$confirm = trim(fgets(STDIN));

if ($confirm === 'yes') {
    foreach ($commands as $cmd) {
        instant_remote_process([$cmd], $server);
        echo "✓ Executed: " . substr($cmd, 0, 50) . "...\n";
    }
    echo "\n✅ ForwardAuth configuration complete\!\n";
} else {
    echo "Cancelled.\n";
}
