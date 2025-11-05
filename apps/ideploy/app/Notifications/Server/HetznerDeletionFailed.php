<?php

namespace App\Notifications\Server;

use App\Notifications\CustomEmailNotification;
use App\Notifications\Dto\DiscordMessage;
use App\Notifications\Dto\PushoverMessage;
use App\Notifications\Dto\SlackMessage;
use Illuminate\Notifications\Messages\MailMessage;

class HetznerDeletionFailed extends CustomEmailNotification
{
    public function __construct(public int $hetznerServerId, public int $teamId, public string $errorMessage)
    {
        $this->onQueue('high');
    }

    public function via(object $notifiable): array
    {
        ray('hello');
        ray($notifiable);

        return $notifiable->getEnabledChannels('hetzner_deletion_failed');
    }

    public function toMail(): MailMessage
    {
        $mail = new MailMessage;
        $mail->subject("Ideploy: [ACTION REQUIRED] Failed to delete Hetzner server #{$this->hetznerServerId}");
        $mail->view('emails.hetzner-deletion-failed', [
            'hetznerServerId' => $this->hetznerServerId,
            'errorMessage' => $this->errorMessage,
        ]);

        return $mail;
    }

    public function toDiscord(): DiscordMessage
    {
        return new DiscordMessage(
            title: ':cross_mark: Ideploy: [ACTION REQUIRED] Failed to delete Hetzner server',
            description: "Failed to delete Hetzner server #{$this->hetznerServerId} from Hetzner Cloud.\n\n**Error:** {$this->errorMessage}\n\nThe server has been removed from Ideploy, but may still exist in your Hetzner Cloud account. Please check your Hetzner Cloud console and manually delete the server if needed.",
            color: DiscordMessage::errorColor(),
        );
    }

    public function toTelegram(): array
    {
        return [
            'message' => "Ideploy: [ACTION REQUIRED] Failed to delete Hetzner server #{$this->hetznerServerId} from Hetzner Cloud.\n\nError: {$this->errorMessage}\n\nThe server has been removed from Ideploy, but may still exist in your Hetzner Cloud account. Please check your Hetzner Cloud console and manually delete the server if needed.",
        ];
    }

    public function toPushover(): PushoverMessage
    {
        return new PushoverMessage(
            title: 'Hetzner Server Deletion Failed',
            level: 'error',
            message: "[ACTION REQUIRED] Failed to delete Hetzner server #{$this->hetznerServerId}.\n\nError: {$this->errorMessage}\n\nThe server has been removed from Ideploy, but may still exist in your Hetzner Cloud account. Please check and manually delete if needed.",
        );
    }

    public function toSlack(): SlackMessage
    {
        return new SlackMessage(
            title: 'Ideploy: [ACTION REQUIRED] Hetzner Server Deletion Failed',
            description: "Failed to delete Hetzner server #{$this->hetznerServerId} from Hetzner Cloud.\n\nError: {$this->errorMessage}\n\nThe server has been removed from Ideploy, but may still exist in your Hetzner Cloud account. Please check your Hetzner Cloud console and manually delete the server if needed.",
            color: SlackMessage::errorColor()
        );
    }
}
