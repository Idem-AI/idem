<?php

namespace App\Services\AI;

use App\Contracts\AIProviderInterface;
use Illuminate\Support\Facades\Log;

class AIProviderManager
{
    private static ?AIProviderInterface $instance = null;

    /**
     * Get current AI provider instance
     */
    public static function getProvider(): AIProviderInterface
    {
        if (self::$instance === null) {
            self::$instance = self::createProvider();
        }

        return self::$instance;
    }

    /**
     * Alias for getProvider() - Laravel-style factory method
     */
    public static function make(): AIProviderInterface
    {
        return self::getProvider();
    }

    /**
     * Create provider based on configuration
     */
    private static function createProvider(): AIProviderInterface
    {
        $providerName = config('ai.default_provider', 'gemini');

        Log::info("Initializing AI provider: {$providerName}");

        return match($providerName) {
            'gemini' => new GeminiProvider(),
            'openai' => new OpenAIProvider(),
            'claude' => new ClaudeProvider(),
            'local' => new LocalLLMProvider(),
            default => throw new \Exception("Unsupported AI provider: {$providerName}"),
        };
    }

    /**
     * Check if AI is available
     */
    public static function isAvailable(): bool
    {
        try {
            return self::getProvider()->isAvailable();
        } catch (\Exception $e) {
            Log::error('AI provider not available: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get provider name
     */
    public static function getProviderName(): string
    {
        return self::getProvider()->getName();
    }

    /**
     * Reset provider instance (useful for testing)
     */
    public static function reset(): void
    {
        self::$instance = null;
    }
}
