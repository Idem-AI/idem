<?php

return [
    /*
    |--------------------------------------------------------------------------
    | AI Provider Configuration
    |--------------------------------------------------------------------------
    |
    | Configure which AI provider to use for deployment assistance.
    | Supported: 'gemini', 'openai', 'claude', 'local'
    */

    'default_provider' => env('AI_PROVIDER', 'gemini'),

    // Multi-Agents Architecture
    'use_multi_agents' => env('AI_USE_MULTI_AGENTS', true),  // Enable intelligent multi-agent analysis

    /*
    |--------------------------------------------------------------------------
    | Provider API Keys
    |--------------------------------------------------------------------------
    */

    'providers' => [
        'gemini' => [
            'api_key' => env('GEMINI_API_KEY'),
            'model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),  // Has quota available
            'base_url' => 'https://generativelanguage.googleapis.com/v1beta',
            'timeout' => 90,
        ],

        'openai' => [
            'api_key' => env('OPENAI_API_KEY'),
            'model' => env('OPENAI_MODEL', 'gpt-4'),
            'base_url' => 'https://api.openai.com/v1',
            'timeout' => 30,
        ],

        'claude' => [
            'api_key' => env('CLAUDE_API_KEY'),
            'model' => env('CLAUDE_MODEL', 'claude-3-5-sonnet-20241022'),
            'base_url' => 'https://api.anthropic.com/v1',
            'timeout' => 30,
        ],

        'local' => [
            'base_url' => env('LOCAL_LLM_URL', 'http://localhost:11434'),
            'model' => env('LOCAL_LLM_MODEL', 'mistral'),
            'timeout' => 60,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Features
    |--------------------------------------------------------------------------
    */

    'features' => [
        'repository_analysis' => env('AI_REPOSITORY_ANALYSIS', true),
        'error_diagnosis' => env('AI_ERROR_DIAGNOSIS', true),
        'optimization' => env('AI_OPTIMIZATION', true),
        'auto_deploy' => env('AI_AUTO_DEPLOY', false), // Nécessite validation
    ],

    /*
    |--------------------------------------------------------------------------
    | Limits
    |--------------------------------------------------------------------------
    */

    'limits' => [
        'max_requests_per_hour' => env('AI_MAX_REQUESTS_PER_HOUR', 100),
        'max_context_size' => env('AI_MAX_CONTEXT_SIZE', 50000), // caractères
    ],
];
