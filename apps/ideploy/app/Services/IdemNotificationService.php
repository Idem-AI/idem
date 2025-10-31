<?php

namespace App\Services;

use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Http;

class IdemNotificationService
{
    /**
     * Send subscription expiry warning
     */
    public function sendExpiryWarning(Team $team, int $daysRemaining): void
    {
        $owner = $team->members()->wherePivot('role', 'owner')->first();
        
        if (!$owner) {
            return;
        }

        $data = [
            'team' => $team->name,
            'plan' => $team->idem_subscription_plan,
            'days_remaining' => $daysRemaining,
            'expires_at' => $team->idem_subscription_expires_at,
        ];

        // Send email
        $this->sendEmail(
            $owner->email,
            "Votre abonnement IDEM expire dans {$daysRemaining} jours",
            'idem.subscription-expiry-warning',
            $data
        );

        // Send Slack notification if configured
        $this->sendSlackNotification(
            "⚠️ L'abonnement de l'équipe **{$team->name}** expire dans {$daysRemaining} jours",
            $data
        );
    }

    /**
     * Send quota limit reached notification
     */
    public function sendQuotaLimitReached(Team $team, string $resourceType): void
    {
        $owner = $team->members()->wherePivot('role', 'owner')->first();
        
        if (!$owner) {
            return;
        }

        $data = [
            'team' => $team->name,
            'resource_type' => $resourceType,
            'plan' => $team->idem_subscription_plan,
            'current_usage' => $resourceType === 'app' ? $team->idem_apps_count : $team->idem_servers_count,
            'limit' => $resourceType === 'app' ? $team->idem_app_limit : $team->idem_server_limit,
        ];

        // Send email
        $this->sendEmail(
            $owner->email,
            "Limite de quota atteinte - IDEM",
            'idem.quota-limit-reached',
            $data
        );
    }

    /**
     * Send quota warning (80% reached)
     */
    public function sendQuotaWarning(Team $team, string $resourceType, float $percentage): void
    {
        $owner = $team->members()->wherePivot('role', 'owner')->first();
        
        if (!$owner) {
            return;
        }

        $data = [
            'team' => $team->name,
            'resource_type' => $resourceType,
            'percentage' => round($percentage),
            'plan' => $team->idem_subscription_plan,
        ];

        // Send email
        $this->sendEmail(
            $owner->email,
            "Vous approchez de votre limite de quota - IDEM",
            'idem.quota-warning',
            $data
        );
    }

    /**
     * Send subscription changed notification
     */
    public function sendSubscriptionChanged(Team $team, string $oldPlan, string $newPlan): void
    {
        $owner = $team->members()->wherePivot('role', 'owner')->first();
        
        if (!$owner) {
            return;
        }

        $data = [
            'team' => $team->name,
            'old_plan' => $oldPlan,
            'new_plan' => $newPlan,
        ];

        // Send email
        $this->sendEmail(
            $owner->email,
            "Votre abonnement a été modifié - IDEM",
            'idem.subscription-changed',
            $data
        );

        // Send Slack notification
        $this->sendSlackNotification(
            "✅ L'équipe **{$team->name}** est passée du plan **{$oldPlan}** à **{$newPlan}**",
            $data
        );
    }

    /**
     * Send payment failed notification
     */
    public function sendPaymentFailed(Team $team): void
    {
        $owner = $team->members()->wherePivot('role', 'owner')->first();
        
        if (!$owner) {
            return;
        }

        $data = [
            'team' => $team->name,
            'plan' => $team->idem_subscription_plan,
        ];

        // Send email
        $this->sendEmail(
            $owner->email,
            "Échec du paiement - IDEM",
            'idem.payment-failed',
            $data
        );

        // Send Slack alert
        $this->sendSlackNotification(
            "❌ Échec du paiement pour l'équipe **{$team->name}**",
            $data,
            'danger'
        );
    }

    /**
     * Send welcome email
     */
    public function sendWelcome(User $user): void
    {
        $data = [
            'name' => $user->name,
            'email' => $user->email,
        ];

        $this->sendEmail(
            $user->email,
            "Bienvenue sur IDEM SaaS",
            'idem.welcome',
            $data
        );
    }

    /**
     * Send admin promotion notification
     */
    public function sendAdminPromotion(User $user): void
    {
        $data = [
            'name' => $user->name,
        ];

        $this->sendEmail(
            $user->email,
            "Vous avez été promu administrateur - IDEM",
            'idem.admin-promotion',
            $data
        );
    }

    /**
     * Generic email sender
     */
    protected function sendEmail(string $to, string $subject, string $template, array $data): void
    {
        try {
            // For now, just log the email (implement actual mailing later)
            Log::info('IDEM Email notification', [
                'to' => $to,
                'subject' => $subject,
                'template' => $template,
                'data' => $data,
            ]);

            // TODO: Implement actual email sending with Mail facade
            // Mail::to($to)->send(new IdemNotificationMail($subject, $template, $data));
        } catch (\Exception $e) {
            Log::error('Failed to send email notification', [
                'to' => $to,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Send Slack notification
     */
    protected function sendSlackNotification(string $message, array $data = [], string $level = 'info'): void
    {
        $webhookUrl = config('idem.notifications.slack_webhook');
        
        if (!$webhookUrl) {
            return;
        }

        try {
            $color = match($level) {
                'success' => '#36a64f',
                'warning' => '#ff9800',
                'danger' => '#f44336',
                default => '#2196f3',
            };

            Http::post($webhookUrl, [
                'attachments' => [[
                    'color' => $color,
                    'text' => $message,
                    'fields' => collect($data)->map(fn($value, $key) => [
                        'title' => ucfirst(str_replace('_', ' ', $key)),
                        'value' => is_array($value) ? json_encode($value) : $value,
                        'short' => true,
                    ])->values()->all(),
                    'footer' => 'IDEM SaaS',
                    'ts' => time(),
                ]],
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send Slack notification', [
                'message' => $message,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Send Discord notification
     */
    protected function sendDiscordNotification(string $message, array $data = []): void
    {
        $webhookUrl = config('idem.notifications.discord_webhook');
        
        if (!$webhookUrl) {
            return;
        }

        try {
            Http::post($webhookUrl, [
                'content' => $message,
                'embeds' => [[
                    'description' => json_encode($data, JSON_PRETTY_PRINT),
                    'color' => 3447003,
                    'timestamp' => now()->toIso8601String(),
                ]],
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send Discord notification', [
                'message' => $message,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
