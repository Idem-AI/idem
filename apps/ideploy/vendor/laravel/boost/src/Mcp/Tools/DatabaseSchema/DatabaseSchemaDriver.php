<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Tools\DatabaseSchema;

abstract class DatabaseSchemaDriver
{
    protected $connection;

    public function __construct($connection = null)
    {
        $this->connection = $connection;
    }

    abstract public function getViews(): array;

    abstract public function getStoredProcedures(): array;

    abstract public function getFunctions(): array;

    abstract public function getTriggers(?string $table = null): array;

    abstract public function getCheckConstraints(string $table): array;

    abstract public function getSequences(): array;
}
