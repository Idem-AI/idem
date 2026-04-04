<?php

namespace App\Jobs;

use App\Models\Server;
use App\Traits\ExecuteRemoteCommand;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ConfigureTraefikLoggingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300;

    public function __construct(
        public Server $server
    ) {}

    public function handle(): void
    {
        ray("🔧 Configuring Traefik logging for server {$this->server->name}");

        // Traefik log déjà en JSON via docker-compose
        // On crée juste un symlink pour que CrowdSec puisse lire les logs

        $isDev = config('app.env') === 'local';

        if ($isDev) {
            $traefikLogPath = '/var/lib/docker/volumes/ideploy_dev_ideploy_data/_data/proxy/access.log';
        } else {
            $traefikLogPath = '/data/ideploy/proxy/access.log';
        }

        $commands = [
            "mkdir -p /var/log/traefik",
            "rm -f /var/log/traefik/access.log",
            "ln -sf {$traefikLogPath} /var/log/traefik/access.log",
            "ls -lah /var/log/traefik/access.log",
        ];

        foreach ($commands as $command) {
            $output = instant_remote_process(
                [$command],
                $this->server
            );
            ray("Command output: {$output}");
        }

        // Marquer comme configuré
        $this->server->update([
            'traefik_logging_enabled' => true
        ]);

        ray("✅ Traefik logging configured successfully (symlink created)");
    }
}
