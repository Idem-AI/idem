<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Services\IdemQuotaService;
use App\Services\IdemServerService;
use App\Services\IdemSubscriptionService;
use App\Services\IdemStripeService;
use App\Services\IdemNotificationService;

class IdemServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Register IDEM services as singletons
        $this->app->singleton(IdemQuotaService::class, function ($app) {
            return new IdemQuotaService();
        });

        $this->app->singleton(IdemServerService::class, function ($app) {
            return new IdemServerService();
        });

        $this->app->singleton(IdemSubscriptionService::class, function ($app) {
            return new IdemSubscriptionService();
        });

        $this->app->singleton(IdemStripeService::class, function ($app) {
            return new IdemStripeService($app->make(IdemSubscriptionService::class));
        });

        $this->app->singleton(IdemNotificationService::class, function ($app) {
            return new IdemNotificationService();
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Register middleware aliases
        $router = $this->app['router'];
        
        $router->aliasMiddleware('idem.admin', \App\Http\Middleware\IdemAdminAuth::class);
        $router->aliasMiddleware('idem.quota', \App\Http\Middleware\CheckIdemQuota::class);
        $router->aliasMiddleware('idem.jwt', \App\Http\Middleware\SharedJwtAuth::class);

        // Register commands
        if ($this->app->runningInConsole()) {
            $this->commands([
                \App\Console\Commands\IdemSyncQuotas::class,
                \App\Console\Commands\IdemCreateServer::class,
                \App\Console\Commands\IdemStats::class,
            ]);
        }
    }
}
