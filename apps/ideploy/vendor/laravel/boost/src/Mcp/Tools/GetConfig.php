<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Tools;

use Illuminate\Support\Facades\Config;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;

#[IsReadOnly]
class GetConfig extends Tool
{
    public function description(): string
    {
        return 'Get the value of a specific config variable using dot notation (e.g., "app.name", "database.default")';
    }

    public function schema(ToolInputSchema $schema): ToolInputSchema
    {
        return $schema
            ->string('key')
            ->description('The config key in dot notation (e.g., "app.name", "database.default")')
            ->required();
    }

    /**
     * @param array<string> $arguments
     */
    public function handle(array $arguments): ToolResult
    {
        $key = $arguments['key'];

        if (! Config::has($key)) {
            return ToolResult::error("Config key '{$key}' not found.");
        }

        return ToolResult::json([
            'key' => $key,
            'value' => Config::get($key),
        ]);
    }
}
