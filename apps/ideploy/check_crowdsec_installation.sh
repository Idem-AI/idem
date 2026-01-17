#!/bin/bash

echo "=== CROWDSEC INSTALLATION STATUS ==="
echo ""

# Vérifier dans la DB si l'installation est complète
echo "1. Check Server Status in Database:"
docker exec idem-ideploy-dev php artisan tinker --execute="
\$server = App\Models\Server::first();
if (\$server) {
    echo 'Server: ' . \$server->name . PHP_EOL;
    echo 'crowdsec_installed: ' . (\$server->crowdsec_installed ? 'TRUE' : 'FALSE') . PHP_EOL;
    echo 'crowdsec_available: ' . (\$server->crowdsec_available ? 'TRUE' : 'FALSE') . PHP_EOL;
    echo 'crowdsec_lapi_url: ' . (\$server->crowdsec_lapi_url ?? 'null') . PHP_EOL;
} else {
    echo 'No server found';
}
"
echo ""

echo "2. Laravel Logs (last 20 lines):"
docker exec idem-ideploy-dev tail -n 20 storage/logs/laravel.log
echo ""

echo "3. Check if CrowdSec container is running (on target server):"
echo "   You need to SSH to your server and run:"
echo "   docker ps | grep crowdsec"
echo ""

echo "4. Check CrowdSec logs (on target server):"
echo "   docker logs crowdsec --tail 50"
