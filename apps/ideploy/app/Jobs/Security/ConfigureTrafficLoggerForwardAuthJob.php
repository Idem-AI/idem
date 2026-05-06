<?php
namespace App\Jobs\Security;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ConfigureTrafficLoggerForwardAuthJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public Application $application) {}

    public function handle(): void
    {
        $uuid = $this->application->uuid;
        $currentLabels = $this->application->custom_labels ?? '';
        
        // Ajouter les définitions des middlewares
        $middlewareDefinitions = [
            "traefik.http.middlewares.traffic-logger-{$uuid}.forwardauth.address=http://traffic-logger:8080/forwardauth",
            "traefik.http.middlewares.traffic-logger-{$uuid}.forwardauth.trustforwardheader=true",
            "traefik.http.middlewares.app-uuid-{$uuid}.headers.customrequestheaders.X-App-UUID={$uuid}",
        ];
        
        foreach ($middlewareDefinitions as $label) {
            if (!str_contains($currentLabels, $label)) {
                $currentLabels .= "\n" . $label;
            }
        }
        
        // NOTE: No need to manually add middlewares to the router.
        // fqdnLabelsForTraefik() auto-discovers middlewares from custom_labels via $middlewares_from_labels
        // and appends them to every generated HTTPS/HTTP router automatically.
        
        $this->application->update(['custom_labels' => trim($currentLabels)]);
        ray("ForwardAuth configured for {$this->application->name}");
    }
}
