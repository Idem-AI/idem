<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Resources;

use Laravel\Boost\Mcp\ToolExecutor;
use Laravel\Boost\Mcp\Tools\ApplicationInfo as ApplicationInfoTool;
use Laravel\Mcp\Server\Resource;

class ApplicationInfo extends Resource
{
    public function __construct(protected ToolExecutor $toolExecutor)
    {
    }

    public function description(): string
    {
        return 'Comprehensive application information including PHP version, Laravel version, database engine, all installed packages with their versions, and all Eloquent models in the application.';
    }

    public function uri(): string
    {
        return 'file://instructions/application-info.md';
    }

    public function mimeType(): string
    {
        return 'text/markdown';
    }

    public function read(): string
    {
        $result = $this->toolExecutor->execute(ApplicationInfoTool::class);

        if ($result->isError) {
            return 'Error fetching application information: '.$result->toArray()['content'][0]['text'];
        }

        $data = json_decode($result->toArray()['content'][0]['text'], true);

        if (! $data) {
            return 'Error parsing application information';
        }

        return json_encode($data, JSON_PRETTY_PRINT);
    }
}
