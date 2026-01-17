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
        
        // Ajouter les middlewares à la liste existante (ne pas écraser)
        $middlewareKey = "traefik.http.routers.{$uuid}.middlewares=";
        $lines = explode("\n", $currentLabels);
        $middlewareLineFound = false;
        
        foreach ($lines as $index => $line) {
            if (str_starts_with($line, $middlewareKey)) {
                $middlewareLineFound = true;
                // Extraire les middlewares existants
                $existingMiddlewares = trim(str_replace($middlewareKey, '', $line));
                $middlewaresArray = array_filter(array_map('trim', explode(',', $existingMiddlewares)));
                
                // Ajouter nos nouveaux middlewares s'ils n'existent pas déjà
                if (!in_array("app-uuid-{$uuid}", $middlewaresArray)) {
                    $middlewaresArray[] = "app-uuid-{$uuid}";
                }
                if (!in_array("traffic-logger-{$uuid}", $middlewaresArray)) {
                    $middlewaresArray[] = "traffic-logger-{$uuid}";
                }
                
                // Reconstruire la ligne
                $lines[$index] = $middlewareKey . implode(',', $middlewaresArray);
                break;
            }
        }
        
        // Si la ligne n'existe pas, l'ajouter
        if (!$middlewareLineFound) {
            $lines[] = $middlewareKey . "app-uuid-{$uuid},traffic-logger-{$uuid}";
        }
        
        $currentLabels = implode("\n", $lines);
        $this->application->update(['custom_labels' => trim($currentLabels)]);
        ray("ForwardAuth configured for {$this->application->name}");
    }
}
