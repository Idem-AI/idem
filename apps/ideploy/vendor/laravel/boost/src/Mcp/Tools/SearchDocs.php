<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Tools;

use Generator;
use Laravel\Boost\Concerns\MakesHttpRequests;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;
use Laravel\Roster\Package;
use Laravel\Roster\Roster;

class SearchDocs extends Tool
{
    use MakesHttpRequests;

    public function __construct(protected Roster $roster)
    {
    }

    public function description(): string
    {
        return 'Search for up-to-date version-specific documentation related to this project and its packages. This tool will search Laravel hosted documentation based on the packages installed and is perfect for all Laravel ecosystem packages. Laravel, Inertia, Pest, Livewire, Filament, Nova, Tailwind, and more.'.PHP_EOL.'You must use this tool to search for Laravel-ecosystem docs before using other approaches. The results provided are for this project\'s package version and does not cover all versions of the package.';
    }

    public function schema(ToolInputSchema $schema): ToolInputSchema
    {
        return $schema
            ->raw('queries', [
                'description' => 'List of queries to perform, pass multiple if you aren\'t sure if it is "toggle" or "switch", for example',
                'type' => 'array',
                'items' => [
                    'type' => 'string',
                    'description' => 'Search query',
                ],
            ])->required()
            ->raw('packages', [
                'description' => 'Package names to limit searching to from application-info. Useful if you know the package(s) you need. i.e. laravel/framework, inertiajs/inertia-laravel, @inertiajs/react',
                'type' => 'array',
                'items' => [
                    'type' => 'string',
                    'description' => "The composer package name (e.g., 'symfony/console')",
                ],
            ])

            ->integer('token_limit')
            ->description('Maximum number of tokens to return in the response. Defaults to 10,000 tokens, maximum 1,000,000 tokens.')
            ->optional();
    }

    /**
     * @param array<string, mixed> $arguments
     */
    public function handle(array $arguments): ToolResult|Generator
    {
        $apiUrl = config('boost.hosted.api_url', 'https://boost.laravel.com').'/api/docs';
        $packagesFilter = array_key_exists('packages', $arguments) ? $arguments['packages'] : null;

        $queries = array_filter(
            array_map('trim', $arguments['queries']),
            fn ($query) => $query !== '' && $query !== '*'
        );

        try {
            $packagesCollection = $this->roster->packages();

            // Only search in specific packages
            if ($packagesFilter) {
                $packagesCollection = $packagesCollection->filter(fn (Package $package) => in_array($package->rawName(), $packagesFilter));
            }

            $packages = $packagesCollection->map(function (Package $package) {
                $name = $package->rawName();
                $version = $package->majorVersion().'.x';

                return [
                    'name' => $name,
                    'version' => $version,
                ];
            });

            $packages = $packages->values()->toArray();
        } catch (\Throwable $e) {
            return ToolResult::error('Failed to get packages: '.$e->getMessage());
        }

        $tokenLimit = $arguments['token_limit'] ?? 10000;
        $tokenLimit = min($tokenLimit, 1000000); // Cap at 1M tokens

        $payload = [
            'queries' => $queries,
            'packages' => $packages,
            'token_limit' => $tokenLimit,
            'format' => 'markdown',
        ];

        try {
            $response = $this->client()->asJson()->post($apiUrl, $payload);

            if (! $response->successful()) {
                return ToolResult::error('Failed to search documentation: '.$response->body());
            }
        } catch (\Throwable $e) {
            return ToolResult::error('HTTP request failed: '.$e->getMessage());
        }

        return ToolResult::text($response->body());
    }
}
