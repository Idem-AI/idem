<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DeleteAllUsers extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'idem:delete-all-users {--force : Force deletion without confirmation}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Delete all users from the database (use with caution!)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->warn('⚠️  WARNING: This command will delete ALL users from the database!');
        $this->warn('⚠️  This action is IRREVERSIBLE!');
        $this->newLine();

        // Count users
        $userCount = User::count();
        
        if ($userCount === 0) {
            $this->info('✓ No users found in the database.');
            return Command::SUCCESS;
        }

        $this->info("Found {$userCount} user(s) in the database.");
        $this->newLine();

        // Confirm deletion unless --force flag is used
        if (!$this->option('force')) {
            if (!$this->confirm('Are you sure you want to delete ALL users?', false)) {
                $this->info('Operation cancelled.');
                return Command::SUCCESS;
            }

            // Double confirmation
            if (!$this->confirm('This is your last chance. Really delete ALL users?', false)) {
                $this->info('Operation cancelled.');
                return Command::SUCCESS;
            }
        }

        $this->info('Deleting all users...');
        $this->newLine();

        try {
            DB::beginTransaction();

            // Get all users for logging
            $users = User::all();
            
            $progressBar = $this->output->createProgressBar($userCount);
            $progressBar->start();

            $deletedCount = 0;
            $errorCount = 0;

            foreach ($users as $user) {
                try {
                    Log::info('[IDEM Delete Users] Deleting user', [
                        'user_id' => $user->id,
                        'email' => $user->email,
                        'idem_uid' => $user->idem_uid,
                    ]);

                    // Force delete to bypass soft deletes if any
                    $user->forceDelete();
                    $deletedCount++;

                } catch (\Exception $e) {
                    $errorCount++;
                    Log::error('[IDEM Delete Users] Error deleting user', [
                        'user_id' => $user->id,
                        'email' => $user->email,
                        'error' => $e->getMessage(),
                    ]);
                }

                $progressBar->advance();
            }

            $progressBar->finish();
            $this->newLine(2);

            DB::commit();

            $this->info("✓ Successfully deleted {$deletedCount} user(s).");
            
            if ($errorCount > 0) {
                $this->warn("⚠️  {$errorCount} user(s) could not be deleted. Check logs for details.");
            }

            Log::info('[IDEM Delete Users] Bulk user deletion completed', [
                'deleted_count' => $deletedCount,
                'error_count' => $errorCount,
                'total_count' => $userCount,
            ]);

            return Command::SUCCESS;

        } catch (\Exception $e) {
            DB::rollBack();

            $this->error('✗ Error deleting users: ' . $e->getMessage());
            
            Log::error('[IDEM Delete Users] Bulk deletion failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return Command::FAILURE;
        }
    }
}
