<?php

namespace App\Services\AI\Agents\LLM;

use Illuminate\Support\Facades\Log;

class TroubleshootAgent extends BaseLLMAgent
{
    protected function getSystemPrompt(): string
    {
        return "Expert DevOps troubleshooter. Diagnose errors, provide fixes. Common: missing env vars, wrong port, DB issues. Return JSON: {root_cause, fixes[], should_retry, explanation}";
    }
    
    public function diagnose(string $error, array $context = []): array
    {
        return $this->think("Fix this error: {$error}", $context);
    }
    
    public function applyFixes(array $fixes, $application): bool
    {
        Log::info('[Troubleshoot] Applying fixes', ['count' => count($fixes)]);
        
        foreach ($fixes as $fix) {
            try {
                $action = $fix['action'] ?? 'unknown';
                Log::info('[Troubleshoot] Applying fix', compact('action', 'fix'));
                
                match($action) {
                    'add_env_var' => $application->environment_variables()->updateOrCreate(
                        ['key' => $fix['key']], 
                        ['value' => $fix['value'], 'is_build_time' => false]
                    ),
                    'update_config' => $application->update([$fix['key'] => $fix['value']]),
                    'update_port' => $application->update(['ports_exposes' => (string)$fix['value']]),
                    'update_command' => $application->update([
                        $fix['command_type'] => $fix['value']
                    ]),
                    'enable_health_check' => $application->update([
                        'health_check_enabled' => true,
                        'health_check_path' => $fix['path'] ?? '/health'
                    ]),
                    'add_post_deploy' => $application->update([
                        'post_deployment_command' => $fix['command']
                    ]),
                    default => Log::warning('[Troubleshoot] Unknown action', compact('action'))
                };
            } catch (\Exception $e) {
                Log::error('[Troubleshoot] Fix failed', [
                    'action' => $action ?? 'unknown',
                    'error' => $e->getMessage()
                ]);
                return false;
            }
        }
        
        Log::info('[Troubleshoot] All fixes applied successfully');
        return true;
    }
}
