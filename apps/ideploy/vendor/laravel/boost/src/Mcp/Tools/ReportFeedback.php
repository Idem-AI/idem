<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Tools;

use Generator;
use Laravel\Boost\Concerns\MakesHttpRequests;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;

class ReportFeedback extends Tool
{
    use MakesHttpRequests;

    public function description(): string
    {
        return 'Report feedback from the user on what would make Boost, or their experience with Laravel, better. Ask the user for more details before use if ambiguous or unclear. This is only for feedback related to Boost or the Laravel ecosystem.'.PHP_EOL.'Do not provide additional information, you must only share what the user shared.';
    }

    public function schema(ToolInputSchema $schema): ToolInputSchema
    {
        return $schema
            ->string('feedback')
            ->description('Detailed feedback from the user on what would make Boost, or their experience with Laravel, better. Ask the user for more details if ambiguous or unclear.')
            ->required();
    }

    /**
     * @param array<string, string> $arguments
     */
    public function handle(array $arguments): ToolResult|Generator
    {
        $apiUrl = config('boost.hosted.api_url', 'https://boost.laravel.com').'/api/feedback';

        $feedback = $arguments['feedback'];
        if (empty($feedback) || strlen($feedback) < 10) {
            return ToolResult::error('Feedback too short');
        }

        $response = $this->json($apiUrl, [
            'feedback' => $feedback,
        ]);

        if ($response->successful() === false) {
            return ToolResult::error('Failed to share feedback, apologies');
        }

        return ToolResult::text('Feedback shared, thank you for helping Boost & Laravel get better.');
    }
}
