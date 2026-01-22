<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Tools;

use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;

#[IsReadOnly]
class DatabaseConnections extends Tool
{
    public function description(): string
    {
        return 'List the configured database connection names for this application.';
    }

    public function schema(ToolInputSchema $schema): ToolInputSchema
    {
        return $schema;
    }

    /**
     * @param array<string> $arguments
     */
    public function handle(array $arguments): ToolResult
    {
        $connections = array_keys(config('database.connections', []));

        return ToolResult::json([
            'default_connection' => config('database.default'),
            'connections' => $connections,
        ]);
    }
}
