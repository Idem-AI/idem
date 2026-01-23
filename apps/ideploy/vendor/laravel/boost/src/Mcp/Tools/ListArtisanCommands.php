<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Tools;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;

#[IsReadOnly]
class ListArtisanCommands extends Tool
{
    public function description(): string
    {
        return 'List all available Artisan commands registered in this application.';
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
        $commands = Artisan::all();

        $commandList = [];
        foreach ($commands as $name => $command) {
            /** @var Command $command */
            $commandList[] = [
                'name' => $name,
                'description' => $command->getDescription(),
            ];
        }

        // Sort alphabetically by name for determinism.
        usort($commandList, fn ($firstCommand, $secondCommand) => strcmp($firstCommand['name'], $secondCommand['name']));

        return ToolResult::json($commandList);
    }
}
