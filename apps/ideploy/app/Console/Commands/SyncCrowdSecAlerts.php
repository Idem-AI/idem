<?php

namespace App\Console\Commands;

use App\Jobs\Security\SyncCrowdSecAlertsJob;
use Illuminate\Console\Command;

class SyncCrowdSecAlerts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'crowdsec:sync-alerts';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Manually sync CrowdSec alerts from all servers';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔄 Syncing CrowdSec alerts...');
        
        try {
            // Dispatch job synchronously for testing
            $job = new SyncCrowdSecAlertsJob();
            $job->handle();
            
            $this->info('✅ Alerts synced successfully!');
            $this->info('💡 Check your firewall overview page to see alerts');
            
            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('❌ Failed to sync alerts: ' . $e->getMessage());
            $this->error($e->getTraceAsString());
            
            return Command::FAILURE;
        }
    }
}
