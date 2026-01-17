#!/bin/bash

echo "=== QUEUE STATUS CHECK ==="
echo ""

echo "1. Jobs in Redis Queue:"
docker exec idem-redis redis-cli LLEN "queues:default"
echo ""

echo "2. Pending Jobs Details:"
docker exec idem-redis redis-cli LRANGE "queues:default" 0 -1
echo ""

echo "3. Failed Jobs (if any):"
docker exec idem-ideploy-dev php artisan queue:failed
echo ""

echo "4. Listen to Queue (Ctrl+C to stop):"
echo "   Run: docker exec idem-ideploy-dev php artisan queue:listen --queue=default --timeout=300"
echo ""

echo "5. Process ONE job immediately:"
echo "   Run: docker exec idem-ideploy-dev php artisan queue:work --once --timeout=300"
