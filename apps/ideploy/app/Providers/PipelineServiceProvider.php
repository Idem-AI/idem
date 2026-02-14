<?php

namespace App\Providers;

use App\Services\Pipeline\SonarQubeApiService;
use App\Services\Pipeline\TrivyApiService;
use Illuminate\Support\ServiceProvider;

class PipelineServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Bind SonarQubeApiService avec la configuration
        $this->app->singleton(SonarQubeApiService::class, function ($app) {
            return new SonarQubeApiService(
                baseUrl: config('services.sonarqube.url'),
                adminToken: config('services.sonarqube.admin_token')
            );
        });

        // Bind TrivyApiService avec la configuration
        $this->app->singleton(TrivyApiService::class, function ($app) {
            return new TrivyApiService(
                baseUrl: config('services.trivy.url')
            );
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
