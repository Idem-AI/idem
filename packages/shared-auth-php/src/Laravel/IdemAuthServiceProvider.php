<?php

namespace Idem\SharedAuth\Laravel;

use Illuminate\Support\ServiceProvider;
use Idem\SharedAuth\AuthClient;
use Idem\SharedAuth\Laravel\Middleware\ApiAuthMiddleware;

/**
 * Service Provider Laravel pour le package shared-auth-php
 */
class IdemAuthServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Fusionner la configuration
        $this->mergeConfigFrom(
            __DIR__ . '/../../config/idem-auth.php',
            'idem-auth'
        );

        // Enregistrer AuthClient comme singleton
        $this->app->singleton(AuthClient::class, function ($app) {
            $apiUrl = config('idem.api_url', 'http://localhost:3001');
            return new AuthClient($apiUrl);
        });

        // Alias pour faciliter l'injection
        $this->app->alias(AuthClient::class, 'idem.auth.client');
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Publier la configuration
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../../config/idem-auth.php' => config_path('idem-auth.php'),
            ], 'idem-auth-config');
        }

        // Enregistrer le middleware
        $router = $this->app['router'];
        $router->aliasMiddleware('idem.auth', ApiAuthMiddleware::class);
    }

    /**
     * Get the services provided by the provider.
     */
    public function provides(): array
    {
        return [
            AuthClient::class,
            'idem.auth.client',
        ];
    }
}
