<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Tools;

use Exception;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Laravel\Boost\Mcp\Tools\DatabaseSchema\SchemaDriverFactory;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;

#[IsReadOnly]
class DatabaseSchema extends Tool
{
    public function description(): string
    {
        return 'Read the database schema for this application, including table names, columns, data types, indexes, foreign keys, and more.';
    }

    public function schema(ToolInputSchema $schema): ToolInputSchema
    {
        $schema->string('database')
            ->description('Name of the database connection to dump (defaults to app\'s default connection, often not needed)')
            ->required(false);

        $schema->string('filter')
            ->description('Filter the tables by name')
            ->required(false);

        return $schema;
    }

    /**
     * @param array<string> $arguments
     */
    public function handle(array $arguments): ToolResult
    {
        $connection = $arguments['database'] ?? config('database.default');
        $filter = $arguments['filter'] ?? '';
        $cacheKey = "boost:mcp:database-schema:{$connection}:{$filter}";

        $schema = Cache::remember($cacheKey, 20, function () use ($connection, $filter) {
            return $this->getDatabaseStructure($connection, $filter);
        });

        return ToolResult::json($schema);
    }

    protected function getDatabaseStructure(?string $connection, string $filter = ''): array
    {
        return [
            'engine' => DB::connection($connection)->getDriverName(),
            'tables' => $this->getAllTablesStructure($connection, $filter),
            'global' => $this->getGlobalStructure($connection),
        ];
    }

    protected function getAllTablesStructure(?string $connection, string $filter = ''): array
    {
        $structures = [];

        foreach ($this->getAllTables($connection) as $table) {
            $tableName = $table['name'];

            if ($filter && ! str_contains(strtolower($tableName), strtolower($filter))) {
                continue;
            }

            $structures[$tableName] = $this->getTableStructure($connection, $tableName);
        }

        return $structures;
    }

    protected function getAllTables(?string $connection): array
    {
        return Schema::connection($connection)->getTables();
    }

    protected function getTableStructure(?string $connection, string $tableName): array
    {
        $driver = SchemaDriverFactory::make($connection);

        try {
            $columns = $this->getTableColumns($connection, $tableName);
            $indexes = $this->getTableIndexes($connection, $tableName);
            $foreignKeys = $this->getTableForeignKeys($connection, $tableName);
            $triggers = $driver->getTriggers($tableName);
            $checkConstraints = $driver->getCheckConstraints($tableName);

            return [
                'columns' => $columns,
                'indexes' => $indexes,
                'foreign_keys' => $foreignKeys,
                'triggers' => $triggers,
                'check_constraints' => $checkConstraints,
            ];
        } catch (Exception $e) {
            Log::error('Failed to get table structure for: '.$tableName, [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'error' => 'Failed to get structure: '.$e->getMessage(),
            ];
        }
    }

    protected function getTableColumns(?string $connection, string $tableName): array
    {
        $columns = Schema::connection($connection)->getColumnListing($tableName);
        $columnDetails = [];

        foreach ($columns as $column) {
            $columnDetails[$column] = [
                'type' => Schema::connection($connection)->getColumnType($tableName, $column),
            ];
        }

        return $columnDetails;
    }

    protected function getTableIndexes(?string $connection, string $tableName): array
    {
        try {
            $indexes = Schema::connection($connection)->getIndexes($tableName);
            $indexDetails = [];

            foreach ($indexes as $index) {
                $indexDetails[$index['name']] = [
                    'columns' => Arr::get($index, 'columns'),
                    'type' => Arr::get($index, 'type'),
                    'is_unique' => Arr::get($index, 'unique', false),
                    'is_primary' => Arr::get($index, 'primary', false),
                ];
            }

            return $indexDetails;
        } catch (Exception) {
            return [];
        }
    }

    protected function getTableForeignKeys(?string $connection, string $tableName): array
    {
        try {
            return Schema::connection($connection)->getForeignKeys($tableName);
        } catch (Exception) {
            return [];
        }
    }

    protected function getGlobalStructure(?string $connection): array
    {
        $driver = SchemaDriverFactory::make($connection);

        return [
            'views' => $driver->getViews(),
            'stored_procedures' => $driver->getStoredProcedures(),
            'functions' => $driver->getFunctions(),
            'sequences' => $driver->getSequences(),
        ];
    }
}
