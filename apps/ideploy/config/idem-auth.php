<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Central API URL
    |--------------------------------------------------------------------------
    |
    | URL de l'API centrale Idem pour l'authentification et l'autorisation
    |
    */

    'api_url' => env('IDEM_API_URL', 'http://localhost:3001'),

    /*
    |--------------------------------------------------------------------------
    | Cache Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration du cache pour les données utilisateur et teams
    |
    */

    'cache' => [
        'enabled' => env('IDEM_AUTH_CACHE_ENABLED', true),
        'ttl' => env('IDEM_AUTH_CACHE_TTL', 300), // 5 minutes
        'prefix' => 'idem_auth:',
    ],

    /*
    |--------------------------------------------------------------------------
    | User Synchronization
    |--------------------------------------------------------------------------
    |
    | Options de synchronisation des utilisateurs
    |
    */

    'sync' => [
        'auto_create_users' => env('IDEM_AUTH_AUTO_CREATE_USERS', true),
        'auto_update_users' => env('IDEM_AUTH_AUTO_UPDATE_USERS', true),
        'fetch_profile_from_api' => env('IDEM_AUTH_FETCH_PROFILE', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Logging
    |--------------------------------------------------------------------------
    |
    | Configuration des logs d'authentification
    |
    */

    'logging' => [
        'enabled' => env('IDEM_AUTH_LOGGING_ENABLED', true),
        'channel' => env('IDEM_AUTH_LOG_CHANNEL', 'stack'),
        'log_successful_auth' => env('IDEM_AUTH_LOG_SUCCESS', true),
        'log_failed_auth' => env('IDEM_AUTH_LOG_FAILURES', true),
    ],

];
