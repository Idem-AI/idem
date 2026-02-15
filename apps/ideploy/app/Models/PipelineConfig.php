<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PipelineConfig extends Model
{
    protected $fillable = [
        'application_id',
        'enabled',
        'auto_trigger_on_push',
        'auto_trigger_on_pr',
        'watch_paths',
        'stages',
        'trigger_mode',
        'trigger_branches',
        'environment_vars',
        'config',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'auto_trigger_on_push' => 'boolean',
        'auto_trigger_on_pr' => 'boolean',
        'stages' => 'array',
        'trigger_branches' => 'array',
        'watch_paths' => 'array',
        'environment_vars' => 'array',
        'config' => 'array',
    ];

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function executions(): HasMany
    {
        return $this->hasMany(PipelineExecution::class);
    }

    public function getEnabledStagesAttribute(): array
    {
        return collect($this->stages ?? [])
            ->filter(fn($stage) => $stage['enabled'] ?? false)
            ->values()
            ->toArray();
    }
}
