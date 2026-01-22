<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Tools;

use Illuminate\Support\Arr;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;

#[IsReadOnly]
class ListAvailableEnvVars extends Tool
{
    public function description(): string
    {
        return '🔧 List all available environment variable names from a given .env file (default .env).';
    }

    public function schema(ToolInputSchema $schema): ToolInputSchema
    {
        $schema->string('filename')
            ->description('The name of the .env file to read (e.g. .env, .env.example). Defaults to .env if not provided.')
            ->required(false);

        return $schema;
    }

    /**
     * @param array<string> $arguments
     */
    public function handle(array $arguments): ToolResult
    {
        $filename = Arr::get($arguments, 'filename', '.env');

        $filePath = base_path($filename);

        if (! str_contains($filePath, '.env')) {
            return ToolResult::error('This tool can only read .env files');
        }

        if (! file_exists($filePath)) {
            return ToolResult::error("File not found at '{$filePath}'");
        }

        $envLines = file_get_contents($filePath);

        if (! $envLines) {
            return ToolResult::error('Failed to read .env file.');
        }

        $count = preg_match_all('/^(?!\s*#)\s*([^=\s]+)=/m', $envLines, $matches);

        if (! $count) {
            return ToolResult::error('Failed to parse .env file');
        }

        $envVars = array_map('trim', $matches[1]);

        sort($envVars);

        return ToolResult::json($envVars);
    }
}
