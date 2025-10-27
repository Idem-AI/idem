<?php

namespace App\Console\Commands;

use App\Models\InstanceSettings;
use App\Models\ServerSetting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FixEncryptedFields extends Command
{
    protected $signature = 'encryption:fix {--dry-run : Show what would be fixed without making changes}';

    protected $description = 'Fix encrypted fields that cannot be decrypted due to APP_KEY change';

    public function handle()
    {
        $dryRun = $this->option('dry-run');
        
        if ($dryRun) {
            $this->warn('Running in DRY RUN mode - no changes will be made');
        }

        $this->info('Checking and fixing encrypted fields...');
        
        // Fix ServerSettings sentinel_token
        $this->fixServerSettings($dryRun);
        
        // Fix InstanceSettings sentinel_token
        $this->fixInstanceSettings($dryRun);

        $this->info('Encryption fix completed!');

        return 0;
    }

    protected function fixServerSettings(bool $dryRun): void
    {
        $this->info("\nChecking ServerSettings...");
        
        $settings = ServerSetting::all();
        $fixed = 0;
        $errors = 0;

        foreach ($settings as $setting) {
            try {
                // Try to access the sentinel_token (will trigger decryption)
                $token = $setting->sentinel_token;
                
                if ($token === null && $setting->getRawOriginal('sentinel_token') !== null) {
                    // Token exists in DB but couldn't be decrypted
                    $this->warn("  Server '{$setting->server->name}' (ID: {$setting->id}): Invalid encrypted token");
                    
                    if (!$dryRun) {
                        DB::table('server_settings')
                            ->where('id', $setting->id)
                            ->update(['sentinel_token' => null]);
                        
                        $setting->fresh()->generateSentinelToken(save: true, ignoreEvent: true);
                        $this->info("    ✓ Regenerated sentinel_token");
                        $fixed++;
                    } else {
                        $this->info("    → Would regenerate sentinel_token");
                        $fixed++;
                    }
                }
            } catch (\Throwable $e) {
                $this->error("  Server setting ID {$setting->id}: {$e->getMessage()}");
                $errors++;
            }
        }

        $this->info("ServerSettings: {$fixed} tokens " . ($dryRun ? 'would be' : 'were') . " regenerated, {$errors} errors");
    }

    protected function fixInstanceSettings(bool $dryRun): void
    {
        $this->info("\nChecking InstanceSettings...");
        
        try {
            $settings = InstanceSettings::get();
            
            if (!$settings) {
                $this->warn("  No instance settings found");
                return;
            }

            // Try to access sentinel_token
            try {
                $token = $settings->sentinel_token;
                $this->info("  Instance sentinel_token: OK");
            } catch (\Throwable $e) {
                $this->warn("  Instance sentinel_token: Invalid encrypted value");
                
                if (!$dryRun) {
                    DB::table('instance_settings')
                        ->where('id', $settings->id)
                        ->update(['sentinel_token' => null]);
                    
                    $this->info("    ✓ Cleared invalid sentinel_token");
                } else {
                    $this->info("    → Would clear invalid sentinel_token");
                }
            }

        } catch (\Throwable $e) {
            $this->error("  Error checking instance settings: {$e->getMessage()}");
        }
    }
}
