<?php

namespace App\Console\Commands;

use App\Models\ServerSetting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RegenerateSentinelTokens extends Command
{
    protected $signature = 'sentinel:regenerate-tokens';

    protected $description = 'Regenerate all sentinel tokens after APP_KEY change';

    public function handle()
    {
        $this->info('Regenerating sentinel tokens...');

        $settings = ServerSetting::all();
        $count = 0;

        foreach ($settings as $setting) {
            try {
                // Clear the old encrypted token by setting it to null
                DB::table('server_settings')
                    ->where('id', $setting->id)
                    ->update(['sentinel_token' => null]);

                // Reload the model to clear cached attributes
                $setting = $setting->fresh();

                // Generate new token
                $setting->generateSentinelToken(save: true, ignoreEvent: true);
                
                $count++;
                $this->info("Regenerated token for server: {$setting->server->name}");
            } catch (\Throwable $e) {
                $this->error("Failed to regenerate token for server setting ID {$setting->id}: {$e->getMessage()}");
            }
        }

        $this->info("Successfully regenerated {$count} sentinel tokens.");

        return 0;
    }
}
