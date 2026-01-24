<?php

namespace App\Console\Commands;

use App\Models\Application;
use Illuminate\Console\Command;

class NormalizeCustomLabels extends Command
{
    protected $signature = 'app:normalize-labels {--app-id=}';
    protected $description = 'Normalize custom_labels to plain text (remove encoding)';

    public function handle()
    {
        $appId = $this->option('app-id');
        
        $query = Application::query();
        if ($appId) {
            $query->where('id', $appId);
        }
        
        $apps = $query->whereNotNull('custom_labels')->get();
        
        foreach ($apps as $app) {
            $this->info("Processing app: {$app->name} (ID: {$app->id})");
            
            $labels = $app->custom_labels;
            
            // Check if it's base64 encoded
            if (base64_decode($labels, true) !== false && 
                base64_encode(base64_decode($labels)) === $labels) {
                
                $decoded = base64_decode($labels);
                $this->warn("  Base64 encoded detected");
                
                // Check for double encoding
                if (base64_decode($decoded, true) !== false && 
                    base64_encode(base64_decode($decoded)) === $decoded) {
                    $decoded = base64_decode($decoded);
                    $this->warn("  Double encoding detected and fixed");
                }
                
                // Store as plain text
                $app->custom_labels = $decoded;
                $app->save();
                $this->info("  Normalized to plain text (" . strlen($decoded) . " bytes)");
            } else {
                $this->info("  Already plain text (" . strlen($labels) . " bytes)");
            }
        }
        
        $this->info("Done! Processed {$apps->count()} applications");
    }
}
