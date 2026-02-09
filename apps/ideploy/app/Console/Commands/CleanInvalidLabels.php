<?php

namespace App\Console\Commands;

use App\Models\Application;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class CleanInvalidLabels extends Command
{
    protected $signature = 'labels:clean-invalid';
    protected $description = 'Remove invalid labels (base64 keys, malformed, etc.)';

    public function handle()
    {
        $this->info('=== CLEANING INVALID LABELS ===');
        $this->newLine();
        
        $apps = Application::whereNotNull('custom_labels')->get();
        
        $cleaned = 0;
        
        foreach ($apps as $application) {
            $this->line("App: {$application->name}");
            
            $labels = $application->custom_labels;
            if (!$labels) {
                $this->line("  No labels");
                continue;
            }
            
            // Decode
            $decoded = base64_decode($labels);
            $lines = collect(preg_split("/\r\n|\n|\r/", $decoded));
            
            $before = $lines->count();
            
            // Filter invalid labels
            $validLines = $lines->filter(function ($value) {
                // Filter out coolify labels
                if (Str::startsWith($value, 'coolify.')) {
                    return false;
                }
                
                // Valid labels must contain '=' and have a key part
                if (!is_string($value) || !str_contains($value, '=')) {
                    return false;
                }
                
                // Filter out labels that are just base64 (no proper key)
                $parts = explode('=', $value, 2);
                if (count($parts) !== 2 || empty(trim($parts[0]))) {
                    return false;
                }
                
                // Filter out keys that look like base64 (very long alphanumeric strings)
                if (strlen($parts[0]) > 100 && ctype_alnum(str_replace(['+', '/', '='], '', $parts[0]))) {
                    return false;
                }
                
                return true;
            });
            
            $after = $validLines->count();
            $removed = $before - $after;
            
            if ($removed > 0) {
                $this->warn("  ⚠️  Removed {$removed} invalid labels");
                
                // Save cleaned labels
                $cleanedContent = $validLines->join("\n");
                $application->update(['custom_labels' => base64_encode($cleanedContent)]);
                
                $this->info("  ✅ CLEANED");
                $cleaned++;
            } else {
                $this->info("  ✅ OK (no invalid labels)");
            }
            
            $this->newLine();
        }
        
        $this->newLine();
        $this->info("=== SUMMARY ===");
        $this->line("Cleaned: {$cleaned}");
        
        return 0;
    }
}
