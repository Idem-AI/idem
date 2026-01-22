<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp;

use Laravel\Boost\Mcp\Methods\CallToolWithExecutor;
use Laravel\Boost\Mcp\Resources\ApplicationInfo;
use Laravel\Mcp\Server;

class Boost extends Server
{
    public string $serverName = 'Laravel Boost';

    public string $serverVersion = '0.0.1';

    public string $instructions = 'Laravel ecosystem MCP server offering database schema access, Artisan commands, error logs, Tinker execution, semantic documentation search and more. Boost helps with code generation.';

    public int $defaultPaginationLength = 50;

    /**
     * @var string[]
     */
    public array $resources = [
        ApplicationInfo::class,
    ];

    public function boot(): void
    {
        $this->discoverTools();
        $this->discoverResources();
        $this->discoverPrompts();

        // Override the tools/call method to use our ToolExecutor
        $this->methods['tools/call'] = CallToolWithExecutor::class;
    }

    /**
     * @return array<string>
     */
    protected function discoverTools(): array
    {
        $excludedTools = config('boost.mcp.tools.exclude', []);
        $toolDir = new \DirectoryIterator(__DIR__.DIRECTORY_SEPARATOR.'Tools');
        foreach ($toolDir as $toolFile) {
            if ($toolFile->isFile() && $toolFile->getExtension() === 'php') {
                $fqdn = 'Laravel\\Boost\\Mcp\\Tools\\'.$toolFile->getBasename('.php');
                if (class_exists($fqdn) && ! in_array($fqdn, $excludedTools, true)) {
                    $this->addTool($fqdn);
                }
            }
        }

        $extraTools = config('boost.mcp.tools.include', []);
        foreach ($extraTools as $toolClass) {
            if (class_exists($toolClass)) {
                $this->addTool($toolClass);
            }
        }

        return $this->registeredTools;
    }

    /**
     * @return array<string>
     */
    protected function discoverResources(): array
    {
        $excludedResources = config('boost.mcp.resources.exclude', []);
        $resourceDir = new \DirectoryIterator(__DIR__.DIRECTORY_SEPARATOR.'Resources');
        foreach ($resourceDir as $resourceFile) {
            if ($resourceFile->isFile() && $resourceFile->getExtension() === 'php') {
                $fqdn = 'Laravel\\Boost\\Mcp\\Resources\\'.$resourceFile;
                if (class_exists($fqdn) && ! in_array($fqdn, $excludedResources, true)) {
                    $this->addResource($fqdn);
                }
            }
        }

        $extraResources = config('boost.mcp.resources.include', []);
        foreach ($extraResources as $resourceClass) {
            if (class_exists($resourceClass)) {
                $this->addResource($resourceClass);
            }
        }

        return $this->registeredResources;
    }

    /**
     * @return array<string>
     */
    protected function discoverPrompts(): array
    {
        $excludedPrompts = config('boost.mcp.prompts.exclude', []);
        $promptDir = new \DirectoryIterator(__DIR__.DIRECTORY_SEPARATOR.'Prompts');
        foreach ($promptDir as $promptFile) {
            if ($promptFile->isFile() && $promptFile->getExtension() === 'php') {
                $fqdn = 'Laravel\\Boost\\Mcp\\Prompts\\'.$promptFile;
                if (class_exists($fqdn) && ! in_array($fqdn, $excludedPrompts, true)) {
                    $this->addPrompt($fqdn);
                }
            }
        }

        $extraPrompts = config('boost.mcp.prompts.include', []);
        foreach ($extraPrompts as $promptClass) {
            if (class_exists($promptClass)) {
                $this->addResource($promptClass);
            }
        }

        return $this->registeredPrompts;
    }
}
