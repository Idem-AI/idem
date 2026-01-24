<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Tools;

use Illuminate\Support\Arr;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;

#[IsReadOnly]
class GetAbsoluteUrl extends Tool
{
    public function description(): string
    {
        return 'Get the absolute URL for a given relative path or named route. If no arguments are provided, you will get the absolute URL for "/"';
    }

    public function schema(ToolInputSchema $schema): ToolInputSchema
    {
        $schema->string('path')
            ->description('The relative URL/path (e.g. "/dashboard") to convert to an absolute URL.')
            ->required(false);

        $schema->string('route')
            ->description('The named route to generate an absolute URL for (e.g. "home").')
            ->required(false);

        return $schema;
    }

    /**
     * @param array<string> $arguments
     */
    public function handle(array $arguments): ToolResult
    {
        $path = Arr::get($arguments, 'path');
        $routeName = Arr::get($arguments, 'route');

        if ($path) {
            return ToolResult::text(url($path));
        }

        if ($routeName) {
            return ToolResult::text(route($routeName));
        }

        return ToolResult::text(url('/'));
    }
}
