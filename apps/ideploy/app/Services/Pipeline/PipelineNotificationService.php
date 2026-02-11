<?php

namespace App\Services\Pipeline;

use App\Models\PipelineExecution;
use App\Models\PipelineNotification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class PipelineNotificationService
{
    /**
     * Send notifications for a pipeline execution event
     */
    public function sendNotifications(PipelineExecution $execution, string $event): void
    {
        $config = $execution->pipelineConfig;
        
        if (!$config) {
            return;
        }

        $notifications = $config->notifications()
            ->where('enabled', true)
            ->get();

        foreach ($notifications as $notification) {
            if ($notification->shouldNotifyFor($event)) {
                $this->sendNotification($notification, $execution, $event);
            }
        }
    }

    /**
     * Send a single notification
     */
    protected function sendNotification(PipelineNotification $notification, PipelineExecution $execution, string $event): void
    {
        try {
            switch ($notification->channel) {
                case 'slack':
                    $this->sendSlackNotification($notification, $execution, $event);
                    break;
                
                case 'discord':
                    $this->sendDiscordNotification($notification, $execution, $event);
                    break;
                
                case 'email':
                    $this->sendEmailNotification($notification, $execution, $event);
                    break;
            }

            Log::info("Pipeline notification sent", [
                'channel' => $notification->channel,
                'event' => $event,
                'execution_id' => $execution->id,
            ]);

        } catch (\Exception $e) {
            Log::error("Failed to send pipeline notification", [
                'channel' => $notification->channel,
                'event' => $event,
                'execution_id' => $execution->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Send Slack notification
     */
    protected function sendSlackNotification(PipelineNotification $notification, PipelineExecution $execution, string $event): void
    {
        if (!$notification->webhook_url) {
            throw new \Exception("Slack webhook URL not configured");
        }

        $color = $this->getEventColor($event);
        $emoji = $this->getEventEmoji($event);
        
        $message = [
            'username' => 'iDeploy Pipeline',
            'icon_emoji' => ':rocket:',
            'attachments' => [
                [
                    'color' => $color,
                    'title' => "{$emoji} Pipeline {$event}",
                    'text' => $this->buildSlackMessage($execution, $event),
                    'fields' => $this->buildSlackFields($execution),
                    'footer' => 'iDeploy CI/CD',
                    'footer_icon' => 'https://ideploy.io/favicon.ico',
                    'ts' => now()->timestamp,
                ]
            ]
        ];

        Http::post($notification->webhook_url, $message);
    }

    /**
     * Send Discord notification
     */
    protected function sendDiscordNotification(PipelineNotification $notification, PipelineExecution $execution, string $event): void
    {
        if (!$notification->webhook_url) {
            throw new \Exception("Discord webhook URL not configured");
        }

        $color = $this->getEventColorDecimal($event);
        $emoji = $this->getEventEmoji($event);
        
        $message = [
            'username' => 'iDeploy Pipeline',
            'avatar_url' => 'https://ideploy.io/favicon.ico',
            'embeds' => [
                [
                    'title' => "{$emoji} Pipeline {$event}",
                    'description' => $this->buildDiscordMessage($execution, $event),
                    'color' => $color,
                    'fields' => $this->buildDiscordFields($execution),
                    'footer' => [
                        'text' => 'iDeploy CI/CD',
                    ],
                    'timestamp' => now()->toIso8601String(),
                ]
            ]
        ];

        Http::post($notification->webhook_url, $message);
    }

    /**
     * Send Email notification
     */
    protected function sendEmailNotification(PipelineNotification $notification, PipelineExecution $execution, string $event): void
    {
        if (!$notification->email) {
            throw new \Exception("Email address not configured");
        }

        $subject = "Pipeline {$event}: {$execution->application->name}";
        $message = $this->buildEmailMessage($execution, $event);

        Mail::raw($message, function ($mail) use ($notification, $subject) {
            $mail->to($notification->email)
                ->subject($subject);
        });
    }

    /**
     * Build Slack message text
     */
    protected function buildSlackMessage(PipelineExecution $execution, string $event): string
    {
        $app = $execution->application;
        $message = "*Application:* {$app->name}\n";
        
        if ($execution->branch) {
            $message .= "*Branch:* `{$execution->branch}`\n";
        }
        
        if ($execution->commit_message) {
            $message .= "*Commit:* {$execution->commit_message}\n";
        }
        
        if ($event === 'failed' && $execution->error_message) {
            $message .= "\n*Error:* {$execution->error_message}\n";
        }

        return $message;
    }

    /**
     * Build Slack fields
     */
    protected function buildSlackFields(PipelineExecution $execution): array
    {
        $fields = [
            [
                'title' => 'Status',
                'value' => ucfirst($execution->status),
                'short' => true,
            ],
            [
                'title' => 'Trigger',
                'value' => ucfirst($execution->trigger_type),
                'short' => true,
            ],
        ];

        if ($execution->duration_seconds) {
            $fields[] = [
                'title' => 'Duration',
                'value' => $this->formatDuration($execution->duration_seconds),
                'short' => true,
            ];
        }

        // Add scan results summary
        $sonarResult = $execution->scanResults()->where('tool', 'sonarqube')->first();
        if ($sonarResult) {
            $fields[] = [
                'title' => 'SonarQube',
                'value' => "Quality Gate: {$sonarResult->quality_gate_status}\nBugs: {$sonarResult->bugs} | Vulnerabilities: {$sonarResult->vulnerabilities}",
                'short' => false,
            ];
        }

        $trivyResult = $execution->scanResults()->where('tool', 'trivy')->first();
        if ($trivyResult) {
            $fields[] = [
                'title' => 'Trivy Security',
                'value' => "Critical: {$trivyResult->critical_count} | High: {$trivyResult->high_count} | Medium: {$trivyResult->medium_count}",
                'short' => false,
            ];
        }

        return $fields;
    }

    /**
     * Build Discord message
     */
    protected function buildDiscordMessage(PipelineExecution $execution, string $event): string
    {
        $app = $execution->application;
        $message = "**Application:** {$app->name}\n";
        
        if ($execution->branch) {
            $message .= "**Branch:** `{$execution->branch}`\n";
        }
        
        if ($execution->commit_message) {
            $message .= "**Commit:** {$execution->commit_message}\n";
        }
        
        if ($event === 'failed' && $execution->error_message) {
            $message .= "\n**Error:** {$execution->error_message}\n";
        }

        return $message;
    }

    /**
     * Build Discord fields
     */
    protected function buildDiscordFields(PipelineExecution $execution): array
    {
        $fields = [
            [
                'name' => 'Status',
                'value' => ucfirst($execution->status),
                'inline' => true,
            ],
            [
                'name' => 'Trigger',
                'value' => ucfirst($execution->trigger_type),
                'inline' => true,
            ],
        ];

        if ($execution->duration_seconds) {
            $fields[] = [
                'name' => 'Duration',
                'value' => $this->formatDuration($execution->duration_seconds),
                'inline' => true,
            ];
        }

        return $fields;
    }

    /**
     * Build Email message
     */
    protected function buildEmailMessage(PipelineExecution $execution, string $event): string
    {
        $app = $execution->application;
        $message = "Pipeline {$event} for {$app->name}\n\n";
        
        $message .= "Details:\n";
        $message .= "- Status: " . ucfirst($execution->status) . "\n";
        $message .= "- Branch: {$execution->branch}\n";
        $message .= "- Commit: {$execution->commit_message}\n";
        $message .= "- Trigger: " . ucfirst($execution->trigger_type) . "\n";
        
        if ($execution->duration_seconds) {
            $message .= "- Duration: " . $this->formatDuration($execution->duration_seconds) . "\n";
        }
        
        if ($event === 'failed' && $execution->error_message) {
            $message .= "\nError:\n{$execution->error_message}\n";
        }

        $message .= "\n---\niDeploy CI/CD Pipeline";

        return $message;
    }

    /**
     * Get color for event (Slack)
     */
    protected function getEventColor(string $event): string
    {
        return match($event) {
            'success' => 'good',
            'failed' => 'danger',
            'started' => '#439FE0',
            default => '#808080',
        };
    }

    /**
     * Get color for event (Discord decimal)
     */
    protected function getEventColorDecimal(string $event): int
    {
        return match($event) {
            'success' => 3066993,  // Green
            'failed' => 15158332,  // Red
            'started' => 3447003,  // Blue
            default => 8421504,    // Gray
        };
    }

    /**
     * Get emoji for event
     */
    protected function getEventEmoji(string $event): string
    {
        return match($event) {
            'success' => '✅',
            'failed' => '❌',
            'started' => '🚀',
            default => 'ℹ️',
        };
    }

    /**
     * Format duration in human-readable format
     */
    protected function formatDuration(int $seconds): string
    {
        if ($seconds < 60) {
            return "{$seconds}s";
        }
        
        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;
        
        return "{$minutes}m {$remainingSeconds}s";
    }
}
