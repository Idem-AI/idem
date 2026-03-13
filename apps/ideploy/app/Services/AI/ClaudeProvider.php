<?php

namespace App\Services\AI;

use App\Contracts\AIProviderInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ClaudeProvider implements AIProviderInterface
{
    private string $apiKey;
    private string $model;

    public function __construct()
    {
        $this->apiKey = config('services.claude.api_key', env('CLAUDE_API_KEY'));
        $this->model = 'claude-3-5-sonnet-20241022';
    }

    public function analyzeRepository(array $context): array
    {
        if (!$this->isAvailable()) {
            throw new \Exception('Claude API key not configured.');
        }

        $prompt = $context['prompt'] ?? 'Analyze codebase and return JSON deployment config';
        
        Log::info('Claude Analysis', ['prompt_length' => strlen($prompt)]);

        $response = Http::timeout(60)
            ->withHeaders([
                'x-api-key' => $this->apiKey,
                'anthropic-version' => '2023-06-01',
                'content-type' => 'application/json',
            ])
            ->post('https://api.anthropic.com/v1/messages', [
                'model' => $this->model,
                'max_tokens' => 4096,
                'temperature' => 0.1,
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => $prompt
                    ]
                ],
            ])->json();

        $text = $response['content'][0]['text'] ?? '{}';
        
        Log::info('Claude Response', ['response_preview' => substr($text, 0, 200)]);
        
        // Claude peut retourner du markdown, on extrait le JSON
        if (preg_match('/```json\s*(.*?)\s*```/s', $text, $matches)) {
            $text = $matches[1];
        }
        
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
        return 'Claude 3.5 Sonnet';
    }
}
