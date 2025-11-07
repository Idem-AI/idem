<?php

return [

    /*
    |--------------------------------------------------------------------------
    | IDEM SaaS Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration options for IDEM SaaS integration with Coolify
    |
    */

    /*
    |--------------------------------------------------------------------------
    | JWT Authentication
    |--------------------------------------------------------------------------
    |
    | JWT secret key shared between main API and IDEM services
    | This should be the same across all integrated systems
    |
    */
    'jwt_secret' => env('JWT_SECRET', env('APP_KEY')),

    /*
    |--------------------------------------------------------------------------
    | Server Selection Strategy
    |--------------------------------------------------------------------------
    |
    | Strategy for selecting IDEM managed servers for deployments:
    | - least_loaded: Select server with lowest load score
    | - round_robin: Rotate between available servers
    | - random: Random selection from available servers
    |
    */
    'server_selection_strategy' => env('IDEM_SERVER_STRATEGY', 'least_loaded'),

    /*
    |--------------------------------------------------------------------------
    | Subscription Plans
    |--------------------------------------------------------------------------
    |
    | Default subscription plan for new teams
    |
    */
    'default_plan' => env('IDEM_DEFAULT_PLAN', 'free'),

    /*
    |--------------------------------------------------------------------------
    | Quota Sync
    |--------------------------------------------------------------------------
    |
    | Automatically sync quotas after certain actions
    |
    */
    'auto_sync_quotas' => env('IDEM_AUTO_SYNC_QUOTAS', true),

    /*
    |--------------------------------------------------------------------------
    | Admin Settings
    |--------------------------------------------------------------------------
    |
    | Settings for IDEM admin functionality
    |
    */
    'admin' => [
        // Allow admins to bypass quota limits
        'bypass_quotas' => env('IDEM_ADMIN_BYPASS_QUOTAS', true),
        
        // Allow admins to see all servers including managed ones
        'see_all_servers' => env('IDEM_ADMIN_SEE_ALL_SERVERS', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Stripe Integration
    |--------------------------------------------------------------------------
    |
    | Stripe settings for subscription payments
    |
    */
    'stripe' => [
        'enabled' => env('IDEM_STRIPE_ENABLED', false),
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        
        // Stripe Price IDs for each plan
        'price_ids' => [
            'basic_monthly' => env('STRIPE_PRICE_ID_BASIC_MONTHLY'),
            'pro_monthly' => env('STRIPE_PRICE_ID_PRO_MONTHLY'),
            'enterprise_monthly' => env('STRIPE_PRICE_ID_ENTERPRISE_MONTHLY'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | External API Integration
    |--------------------------------------------------------------------------
    |
    | Settings for external API integration
    |
    */
    'external_api' => [
        'enabled' => env('IDEM_EXTERNAL_API_ENABLED', false),
        'url' => env('IDEM_EXTERNAL_API_URL'),
        'timeout' => env('IDEM_EXTERNAL_API_TIMEOUT', 30),
    ],

    /*
    |--------------------------------------------------------------------------
    | Feature Flags
    |--------------------------------------------------------------------------
    |
    | Enable/disable specific IDEM features
    |
    */
    'features' => [
        'managed_servers' => env('IDEM_FEATURE_MANAGED_SERVERS', true),
        'personal_servers' => env('IDEM_FEATURE_PERSONAL_SERVERS', true),
        'quota_enforcement' => env('IDEM_FEATURE_QUOTA_ENFORCEMENT', true),
        'admin_dashboard' => env('IDEM_FEATURE_ADMIN_DASHBOARD', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Notifications
    |--------------------------------------------------------------------------
    |
    | Configuration for notification channels
    |
    */
    'notifications' => [
        'email' => [
            'enabled' => env('IDEM_NOTIFICATIONS_EMAIL_ENABLED', true),
            'from_address' => env('MAIL_FROM_ADDRESS', 'noreply@example.com'),
            'from_name' => env('MAIL_FROM_NAME', 'IDEM SaaS'),
        ],
        
        'slack_webhook' => env('IDEM_SLACK_WEBHOOK_URL'),
        'discord_webhook' => env('IDEM_DISCORD_WEBHOOK_URL'),
        
        // Notification triggers
        'triggers' => [
            'quota_warning_threshold' => 80, // Send warning at 80% quota
            'expiry_warning_days' => [30, 14, 7, 3, 1], // Days before expiry to send warnings
        ],
    ],

];
