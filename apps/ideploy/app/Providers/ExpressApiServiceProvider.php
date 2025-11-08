<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Services\ExpressApiClient;

class ExpressApiServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->app->singleton(ExpressApiClient::class, function ($app) {
            return new ExpressApiClient();
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}
