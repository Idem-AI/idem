<?php

namespace App\Providers;

use App\Events\ServerValidated;
use App\Listeners\MaintenanceModeDisabledNotification;
use App\Listeners\MaintenanceModeEnabledNotification;
use App\Listeners\Server\InstallCrowdSecListener;
use Illuminate\Foundation\Events\MaintenanceModeDisabled;
use Illuminate\Foundation\Events\MaintenanceModeEnabled;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use SocialiteProviders\Authentik\AuthentikExtendSocialite;
use SocialiteProviders\Azure\AzureExtendSocialite;
use SocialiteProviders\Clerk\ClerkExtendSocialite;
use SocialiteProviders\Discord\DiscordExtendSocialite;
use SocialiteProviders\Google\GoogleExtendSocialite;
use SocialiteProviders\Infomaniak\InfomaniakExtendSocialite;
use SocialiteProviders\Manager\SocialiteWasCalled;
use SocialiteProviders\Zitadel\ZitadelExtendSocialite;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        MaintenanceModeEnabled::class => [
            MaintenanceModeEnabledNotification::class,
        ],
        MaintenanceModeDisabled::class => [
            MaintenanceModeDisabledNotification::class,
        ],
        ServerValidated::class => [
            InstallCrowdSecListener::class,
            \App\Listeners\Server\InstallTrafficLoggerListener::class,
        ],
        SocialiteWasCalled::class => [
            AzureExtendSocialite::class.'@handle',
            AuthentikExtendSocialite::class.'@handle',
            ClerkExtendSocialite::class.'@handle',
            DiscordExtendSocialite::class.'@handle',
            GoogleExtendSocialite::class.'@handle',
            InfomaniakExtendSocialite::class.'@handle',
            ZitadelExtendSocialite::class.'@handle',
        ],
    ];

    public function boot(): void
    {
        //
    }

    public function shouldDiscoverEvents(): bool
    {
        return true;
    }
}
