<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PipelineNotification extends Model
{
    protected $fillable = [
        'pipeline_config_id',
        'channel',
        'enabled',
        'webhook_url',
        'email',
        'events',
        'config',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'events' => 'array',
        'config' => 'array',
    ];

    public function pipelineConfig(): BelongsTo
    {
        return $this->belongsTo(PipelineConfig::class);
    }

    /**
     * Check if notification should be sent for a specific event
     */
    public function shouldNotifyFor(string $event): bool
    {
        if (!$this->enabled) {
            return false;
        }

        $events = $this->events ?? [];
        return in_array($event, $events);
    }
}
