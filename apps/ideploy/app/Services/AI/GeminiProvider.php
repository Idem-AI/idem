<?php

namespace App\Services\AI;

use App\Contracts\AIProviderInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiProvider implements AIProviderInterface
{
    private ?string $apiKey;
    private string $model;
    private string $baseUrl;
    private int $timeout;

    public function __construct()
    {
        $config = config('ai.providers.gemini');
        $this->apiKey = $config['api_key'] ?? env('GEMINI_API_KEY');
        $this->model = $config['model'] ?? 'gemini-2.5-flash';
        $this->baseUrl = $config['base_url'] ?? 'https://generativelanguage.googleapis.com/v1beta';
        $this->timeout = $config['timeout'] ?? 60;  // Increased for large prompts
    }

    /**
     * Analyse générique avec prompt personnalisé
     */
    public function analyze(array $params): array
    {
        if (!$this->isAvailable()) {
            throw new \Exception('Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.');
        }

        $prompt = $params['prompt'] ?? '';
        
        if (empty($prompt)) {
            throw new \Exception('Prompt is required for analyze()');
        }

        Log::info('Gemini AI Generic Analysis', [
            'prompt_length' => strlen($prompt),
            'model' => $this->model,
        ]);

        try {
            $response = Http::timeout(120)
                ->connectTimeout(30)
                ->retry(3, 2000)
                ->post(
                    "{$this->baseUrl}/models/{$this->model}:generateContent?key={$this->apiKey}",
                    [
                        'contents' => [
                            ['parts' => [['text' => $prompt]]]
                        ],
                        'generationConfig' => [
                            'temperature' => 0.1,
                            'topK' => 40,
                            'topP' => 0.95,
                            'maxOutputTokens' => 8192,
                        ],
                    ]
                )->json();

            if (isset($response['error'])) {
                Log::error('Gemini API error', $response['error']);
                return [];
            }

            $text = $response['candidates'][0]['content']['parts'][0]['text'] ?? '';
            
            // Try to extract JSON from response
            if (preg_match('/\{[\s\S]*\}/', $text, $matches)) {
                $json = json_decode($matches[0], true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    return $json;
                }
            }

            // If no JSON found, return raw text
            return ['response' => $text];

        } catch (\Exception $e) {
            Log::error('Gemini analyze() failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    public function analyzeRepository(array $context): array
    {
        if (!$this->isAvailable()) {
            throw new \Exception('Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.');
        }

        // Use the expert prompt passed from SmartDeploymentAnalyzer
        $prompt = $context['prompt'] ?? $this->buildFallbackPrompt($context);
        
        Log::info('Gemini AI Analysis', [
            'prompt_length' => strlen($prompt),
            'has_files' => !empty($context['files'] ?? []),
            'prompt_preview' => substr($prompt, 0, 500),
            'model' => $this->model,
        ]);

        // Retry up to 3 times if API is overloaded
        $maxRetries = 3;
        $attempt = 0;
        
        while ($attempt < $maxRetries) {
            try {
                $response = Http::timeout(120)
                    ->connectTimeout(30)
                    ->retry(2, 1000)
                    ->post(
                        "{$this->baseUrl}/models/{$this->model}:generateContent?key={$this->apiKey}",
                        [
                            'contents' => [
                                ['parts' => [['text' => $prompt]]]
                            ],
                            'generationConfig' => [
                                'temperature' => 0.1,
                                'topK' => 40,
                                'topP' => 0.95,
                                'maxOutputTokens' => 8192,
                            ],
                        ]
                    )->json();
                
                // Check for API errors
                if (isset($response['error'])) {
                    $errorCode = $response['error']['code'] ?? 0;
                    $errorMsg = $response['error']['message'] ?? 'Unknown error';
                    
                    if ($errorCode === 503 && $attempt < $maxRetries - 1) {
                        Log::warning("Gemini API overloaded, retrying in 2s...", ['attempt' => $attempt + 1]);
                        sleep(2);
                        $attempt++;
                        continue;
                    }
                    
                    Log::error('Gemini API error', ['code' => $errorCode, 'message' => $errorMsg]);
                    return [];
                }
                
                break; // Success
                
            } catch (\Exception $e) {
                Log::error('Gemini API request failed', ['error' => $e->getMessage(), 'attempt' => $attempt + 1]);
                if ($attempt < $maxRetries - 1) {
                    sleep(2);
                    $attempt++;
                } else {
                    return [];
                }
            }
        }

        Log::info('Gemini raw response', ['response' => json_encode($response)]);

        $text = $response['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
        
        Log::info('Gemini AI Response', [
            'response_length' => strlen($text),
            'response_preview' => substr($text, 0, 500),
        ]);
        
        // Extract JSON from markdown code blocks if present
        if (preg_match('/```json\s*(.*?)\s*```/s', $text, $matches)) {
            $text = $matches[1];
            Log::info('Extracted JSON from markdown block');
        } elseif (preg_match('/```\s*(.*?)\s*```/s', $text, $matches)) {
            $text = $matches[1];
            Log::info('Extracted content from code block');
        }
        
        $result = json_decode($text, true);
        
        if (!$result) {
            Log::error('Gemini returned invalid JSON', ['text' => $text]);
            return [];
        }
        
        return $result;
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
            throw new \Exception('Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.');
        }

        $prompt = "Diagnose this deployment error and suggest fix:\n\nLOGS:\n{$logs}\n\nReturn JSON: {\"error\": \"\", \"cause\": \"\", \"solution\": \"\"}";
        
        $response = Http::post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={$this->apiKey}",
            ['contents' => [['parts' => [['text' => $prompt]]]]]
        )->json();

        $text = $response['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
        return json_decode($text, true) ?: [];
    }

    public function optimizeConfiguration(array $application): array
    {
        return ['cpu' => '2', 'memory' => '2GB'];
    }

    public function isAvailable(): bool
    {
        return !empty($this->apiKey);
    }

    public function getName(): string
    {
        return 'Gemini';
    }
}
