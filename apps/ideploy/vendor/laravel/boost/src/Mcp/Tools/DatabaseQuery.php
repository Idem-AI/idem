<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Tools;

use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;
use Throwable;

#[IsReadOnly]
class DatabaseQuery extends Tool
{
    /**
     * Get a short, human-readable description of what the tool does.
     */
    public function description(): string
    {
        return 'Execute a read-only SQL query against the configured database.';
    }

    /**
     * Define the input schema for the tool.
     */
    public function schema(ToolInputSchema $schema): ToolInputSchema
    {
        $schema->string('query')
            ->description('The SQL query to execute. Only read-only queries are allowed (i.e. SELECT, SHOW, EXPLAIN, DESCRIBE).')
            ->required();

        $schema->string('database')
            ->description("Optional database connection name to use. Defaults to the application's default connection.")
            ->required(false);

        return $schema;
    }

    /**
     * @param array<string> $arguments
     */
    public function handle(array $arguments): ToolResult
    {
        $query = trim($arguments['query']);
        $token = strtok(ltrim($query), " \t\n\r");
        if (! $token) {
            return ToolResult::error('Please pass a valid query');
        }
        $firstWord = strtoupper($token);

        // Allowed read-only commands.
        $allowList = [
            'SELECT',
            'SHOW',
            'EXPLAIN',
            'DESCRIBE',
            'DESC',
            'WITH',        // SELECT must follow Common-table expressions
            'VALUES',      // Returns literal values
            'TABLE',       // PostgresSQL shorthand for SELECT *
        ];

        $isReadOnly = in_array($firstWord, $allowList, true);

        // Additional validation for WITH … SELECT.
        if ($firstWord === 'WITH') {
            if (! preg_match('/with\s+.*select\b/i', $query)) {
                $isReadOnly = false;
            }
        }

        if (! $isReadOnly) {
            return ToolResult::error('Only read-only queries are allowed (SELECT, SHOW, EXPLAIN, DESCRIBE, DESC, WITH … SELECT).');
        }

        $connectionName = $arguments['database'] ?? null;

        try {
            return ToolResult::json(
                DB::connection($connectionName)->select($query)
            );
        } catch (Throwable $e) {
            return ToolResult::error('Query failed: '.$e->getMessage());
        }
    }
}
