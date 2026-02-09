<?php

namespace App\Console\Commands;

use App\Models\Application;
use Illuminate\Console\Command;

class FixDoubleEncoding extends Command
{
    protected $signature = 'labels:fix-double-encoding';
    protected $description = 'Fix double base64 encoding in custom labels';

    public function handle()
    {
        $this->info('=== FIXING DOUBLE BASE64 ENCODING ===');
        $this->newLine();
        
        $apps = Application::whereNotNull('custom_labels')->get();
        
        $fixed = 0;
        $ok = 0;
        
        foreach ($apps as $application) {
            $this->line("App: {$application->name}");
            
            $labels = $application->custom_labels;
            if (!$labels) {
                $this->line("  No labels");
                continue;
            }
            
            // Decode once
            $decoded = base64_decode($labels);
            
            // Check if it's valid base64 again (double encoded)
            if (base64_decode($decoded, true) !== false && 
                base64_encode(base64_decode($decoded)) === $decoded) {
                $this->warn("  ⚠️  DOUBLE ENCODED - Fixing...");
                
                // Decode again to get the real content
                $fixedContent = base64_decode($decoded);
                
                // Re-encode once
                $application->update(['custom_labels' => base64_encode($fixedContent)]);
                
                $this->info("  ✅ FIXED");
                $fixed++;
            } else {
                $this->info("  ✅ OK (single encoding)");
                $ok++;
            }
            
            $this->newLine();
        }
        
        $this->newLine();
        $this->info("=== SUMMARY ===");
        $this->line("Fixed: {$fixed}");
        $this->line("Already OK: {$ok}");
        
        return 0;
    }
}
