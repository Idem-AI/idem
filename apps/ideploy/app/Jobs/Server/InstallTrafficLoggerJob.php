<?php

namespace App\Jobs\Server;

use App\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class InstallTrafficLoggerJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300;
    public $tries = 1;

    public function __construct(public Server $server) {}

    public function handle()
    {
        ray("🚀 Installing Traffic Logger on: {$this->server->name}");
        
        try {
            // Create directories
            instant_remote_process([
                'mkdir -p /var/lib/coolify/traffic-logger',
            ], $this->server);
            
            // Upload logger.py
            $loggerPath = base_path('templates/traffic-logger/app/logger.py');
            if (!file_exists($loggerPath)) {
                throw new \Exception("Traffic Logger script not found at: {$loggerPath}");
            }
            $loggerContent = file_get_contents($loggerPath);
            $tmpFile = tempnam(sys_get_temp_dir(), 'logger');
            file_put_contents($tmpFile, $loggerContent);
            instant_scp($tmpFile, '/var/lib/coolify/traffic-logger/logger.py', $this->server);
            unlink($tmpFile);
            
            // Start container
            instant_remote_process([
                'cd /var/lib/coolify/traffic-logger',
                'docker run -d --name traffic-logger --network coolify --restart always ' .
                '-e "CROWDSEC_LAPI_URL=http://crowdsec-live:8080" ' .
                '-e "CROWDSEC_API_KEY=placeholder" ' .
                '-v $(pwd)/logger.py:/app/logger.py:ro ' .
                'python:3.11-slim sh -c "pip install flask requests && python /app/logger.py"',
            ], $this->server);
            
            // Mark as installed
            $this->server->update(['traffic_logger_installed' => true]);
            
            ray("✅ Traffic Logger installed");
        } catch (\Exception $e) {
            ray("❌ Failed: " . $e->getMessage());
            $this->server->update(['traffic_logger_installed' => false]);
            throw $e;
        }
    }
}
