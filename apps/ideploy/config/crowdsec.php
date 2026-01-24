<?php

return [

    /*
    |--------------------------------------------------------------------------
    | CrowdSec Webhook Token
    |--------------------------------------------------------------------------
    |
    | Token utilisé pour authentifier les webhooks CrowdSec.
    | Ce token doit être configuré dans le plugin Traefik bouncer.
    |
    | Générer un token sécurisé :
    | php -r "echo bin2hex(random_bytes(32));"
    |
    */

    'webhook_token' => env('CROWDSEC_WEBHOOK_TOKEN', null),

    /*
    |--------------------------------------------------------------------------
    | CrowdSec LAPI URL
    |--------------------------------------------------------------------------
    |
    | URL par défaut de l'API CrowdSec Local (LAPI).
    | Généralement http://crowdsec:8080 dans Docker.
    |
    */

    'lapi_url' => env('CROWDSEC_LAPI_URL', 'http://crowdsec:8080'),

    /*
    |--------------------------------------------------------------------------
    | Traffic Logging
    |--------------------------------------------------------------------------
    |
    | Configuration du logging de trafic.
    |
    */

    'traffic_logging' => [
        // Activer le webhook traffic logging
        'enabled' => env('CROWDSEC_TRAFFIC_LOGGING_ENABLED', true),
        
        // Nettoyer les anciens logs après X jours
        'retention_days' => env('CROWDSEC_LOG_RETENTION_DAYS', 30),
        
        // Limite de logs par application (pour éviter DB overflow)
        'max_logs_per_app' => env('CROWDSEC_MAX_LOGS_PER_APP', 100000),
    ],

    /*
    |--------------------------------------------------------------------------
    | CrowdSec Docker
    |--------------------------------------------------------------------------
    |
    | Configuration Docker CrowdSec.
    |
    */

    'docker' => [
        // Image Docker à utiliser
        'image' => env('CROWDSEC_DOCKER_IMAGE', 'crowdsecurity/crowdsec:latest'),
        
        // Container name prefix
        'container_prefix' => env('CROWDSEC_CONTAINER_PREFIX', 'crowdsec'),
        
        // Base path pour les configs
        'config_path' => env('CROWDSEC_CONFIG_PATH', '/var/lib/coolify/crowdsec'),
    ],

];
