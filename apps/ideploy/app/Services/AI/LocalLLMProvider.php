<?php

namespace App\Services\AI;

use App\Contracts\AIProviderInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LocalLLMProvider implements AIProviderInterface
{
    private string $baseUrl;
    private string $model;
    private int $timeout;

    public function __construct()
    {
        $config = config('ai.providers.local');
        $this->baseUrl = $config['base_url'] ?? 'http://localhost:11434';
        $this->model = $config['model'] ?? 'llama2';
        $this->timeout = $config['timeout'] ?? 60;
    }

    public function analyzeRepository(array $context): array
    {
        if (!$this->isAvailable()) {
            throw new \Exception('Local LLM not available. Please ensure Ollama is running.');
        }

        $prompt = $context['prompt'] ?? $this->buildFallbackPrompt($context);
        
        Log::info('Local LLM Analysis', ['prompt_length' => strlen($prompt)]);

        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->baseUrl}/api/generate", [
                    'model' => $this->model,
                    'prompt' => $prompt,
                    'stream' => false,
                    'format' => 'json',
                ])->json();

            $text = $response['response'] ?? '{}';
            
            Log::info('Local LLM Response', ['response_preview' => substr($text, 0, 200)]);
            
            return json_decode($text, true) ?: [];
        } catch (\Exception $e) {
            Log::error('Local LLM error: ' . $e->getMessage());
            return [];
        }
    }
    
    private function buildFallbackPrompt(array $context): string
    {
        $prompt = "Analyze this codebase and return JSON deployment config:\n\n";
        $prompt .= "package.json: " . ($context['package_json'] ?? 'none') . "\n";
        $prompt .= "composer.json: " . ($context['composer_json'] ?? 'none') . "\n\n";
        $prompt .= "Return ONLY valid JSON: {\"framework\": \"\", \"buildPack\": \"nixpacks|dockerfile|static\", \"port\": 3000}";
        return $prompt;
    }

    public function diagnoseError(string $logs, array $context): array
    {
        if (!$this->isAvailable()) {
            throw new \Exception('Local LLM not available. Please ensure Ollama is running.');
        }

        $prompt = "Diagnose this deployment error and suggest fix:\n\nLOGS:\n{$logs}\n\nReturn JSON: {\"error\": \"\", \"cause\": \"\", \"solution\": \"\"}";

        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->baseUrl}/api/generate", [
                    'model' => $this->model,
                    'prompt' => $prompt,
                    'stream' => false,
                ])->json();

            $text = $response['response'] ?? '{}';
            return json_decode($text, true) ?: [];
        } catch (\Exception $e) {
            Log::error('Local LLM error: ' . $e->getMessage());
            return [];
        }
    }

    public function optimizeConfiguration(array $application): array
    {
        return [
            'cpu' => '2',
            'memory' => '2GB',
        ];
    }

    public function isAvailable(): bool
    {
        try {
            $response = Http::timeout(5)->get("{$this->baseUrl}/api/tags");
            return $response->successful();
        } catch (\Exception $e) {
            return false;
        }
    }

    public function getName(): string
    {
        return 'Local LLM (Ollama)';
    }
}
