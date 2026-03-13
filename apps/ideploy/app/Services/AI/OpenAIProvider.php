<?php

namespace App\Services\AI;

use App\Contracts\AIProviderInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenAIProvider implements AIProviderInterface
{
    private string $apiKey;

    public function __construct()
    {
        $this->apiKey = config('services.openai.api_key', env('OPENAI_API_KEY'));
    }

    public function analyzeRepository(array $context): array
    {
        if (!$this->isAvailable()) {
            throw new \Exception('OpenAI API key not configured.');
        }

        $prompt = $context['prompt'] ?? 'Analyze codebase and return JSON deployment config';
        
        Log::info('OpenAI Analysis', ['prompt_length' => strlen($prompt)]);

        $response = Http::timeout(60)
            ->withHeaders(['Authorization' => "Bearer {$this->apiKey}"])
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => 'gpt-4o',
                'messages' => [
                    ['role' => 'system', 'content' => 'You are an expert DevOps engineer. Return ONLY valid JSON, no markdown.'],
                    ['role' => 'user', 'content' => $prompt]
                ],
                'temperature' => 0.1,
                'response_format' => ['type' => 'json_object'],
            ])->json();

        $text = $response['choices'][0]['message']['content'] ?? '{}';
        
        Log::info('OpenAI Response', ['response_preview' => substr($text, 0, 200)]);
        
        return json_decode($text, true) ?: [];
    }

    public function diagnoseError(string $logs, array $context): array
    {
        return [];
    }

    public function optimizeConfiguration(array $application): array
    {
        return [];
    }

    public function isAvailable(): bool
    {
        return !empty($this->apiKey);
    }

    public function getName(): string
    {
        return 'OpenAI GPT-4';
    }
}
