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
        'stages',
        'trigger_mode',
        'trigger_branches',
        'environment_vars',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'stages' => 'array',
        'trigger_branches' => 'array',
        'environment_vars' => 'array',
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
