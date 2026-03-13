<?php

namespace App\Services\AI\Agents\LLM;

use App\Services\AI\AIProviderManager;
use Illuminate\Support\Facades\Log;

abstract class BaseLLMAgent
{
    protected $llm;
    protected array $context = [];
    protected array $memory = [];
    protected int $maxRetries = 5;
    
    public function __construct()
    {
        $this->llm = AIProviderManager::make();
    }
    
    protected function think(string $prompt, array $context = []): array
    {
        $fullPrompt = $this->buildPrompt($prompt, $context);
        
        try {
            $response = $this->llm->analyze(['prompt' => $fullPrompt]);
            $this->memory[] = ['prompt' => $prompt, 'response' => $response];
            return $response;
        } catch (\Exception $e) {
            Log::error('[LLM] Think failed', ['error' => $e->getMessage()]);
            return ['error' => $e->getMessage()];
        }
    }
    
    protected function buildPrompt(string $userPrompt, array $context = []): string
    {
        return $this->getSystemPrompt() . "\n\nCONTEXT:\n" . 
               json_encode(array_merge($this->context, $context), JSON_PRETTY_PRINT) .
               "\n\nTASK:\n{$userPrompt}\n\nResponse as JSON.";
    }
    
    protected function executeWithRetry(callable $action, string $name): array
    {
        for ($i = 1; $i <= $this->maxRetries; $i++) {
            try {
                $result = $action();
                if ($result['success'] ?? false) return $result;
                
                if ($i < $this->maxRetries) {
                    $fix = $this->autoFix($name, $result['error'] ?? 'Unknown');
                    if ($fix['should_retry'] ?? false) {
                        $this->applyFix($fix['actions'] ?? []);
                        continue;
                    }
                }
            } catch (\Exception $e) {
                if ($i === $this->maxRetries) throw $e;
            }
        }
        return ['success' => false, 'error' => 'Max retries exceeded'];
    }
    
    protected function autoFix(string $action, string $error): array
    {
        return $this->think("Fix this error: Action='{$action}', Error='{$error}'. 
            JSON: {\"should_retry\": bool, \"actions\": [], \"reasoning\": \"\"}");
    }
    
    protected function applyFix(array $actions): void
    {
        foreach ($actions as $action) {
            $this->context[$action['key'] ?? 'fix'] = $action['value'] ?? null;
        }
    }
    
    abstract protected function getSystemPrompt(): string;
}
