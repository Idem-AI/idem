<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Team;
use App\Services\IdemQuotaService;

class IdemSyncQuotas extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'idem:sync-quotas {--team-id= : Sync specific team ID, or all teams if not specified}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Synchronize IDEM subscription quotas for teams';

    /**
     * Execute the console command.
     */
    public function handle(IdemQuotaService $quotaService): int
    {
        $teamId = $this->option('team-id');

        if ($teamId) {
            $team = Team::find($teamId);
            if (!$team) {
                $this->error("Team with ID {$teamId} not found.");
                return Command::FAILURE;
            }

            $this->info("Syncing quotas for team: {$team->name} (ID: {$team->id})");
            $quotaService->syncQuotas($team);
            
            $usage = $quotaService->getQuotaUsage($team);
            $this->info("Apps: {$usage['apps']['used']} / " . ($usage['apps']['unlimited'] ? 'unlimited' : $usage['apps']['limit']));
            $this->info("Servers: {$usage['servers']['used']} / " . ($usage['servers']['unlimited'] ? 'unlimited' : $usage['servers']['limit']));
            
            return Command::SUCCESS;
        }

        // Sync all teams
        $teams = Team::all();
        $this->info("Syncing quotas for {$teams->count()} teams...");
        
        $progressBar = $this->output->createProgressBar($teams->count());
        $progressBar->start();

        foreach ($teams as $team) {
            $quotaService->syncQuotas($team);
            $progressBar->advance();
        }

        $progressBar->finish();
        $this->newLine();
        $this->info('All team quotas synchronized successfully!');

        return Command::SUCCESS;
    }
}
