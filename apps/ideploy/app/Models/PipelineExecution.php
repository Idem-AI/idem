<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class PipelineExecution extends Model
{
    protected $fillable = [
        'uuid',
        'pipeline_config_id',
        'application_id',
        'trigger_type',
        'trigger_user',
        'commit_sha',
        'commit_message',
        'branch',
        'status',
        'stages_status',
        'started_at',
        'finished_at',
        'duration_seconds',
        'error_message',
    ];

    protected $casts = [
        'stages_status' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'duration_seconds' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function pipelineConfig(): BelongsTo
    {
        return $this->belongsTo(PipelineConfig::class);
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function logs(): HasMany
    {
        return $this->hasMany(PipelineLog::class)->orderBy('logged_at');
    }

    public function jobs(): HasMany
    {
        return $this->hasMany(PipelineJob::class)->orderBy('order');
    }

    public function scanResults(): HasMany
    {
        return $this->hasMany(PipelineScanResult::class);
    }

    public function isRunning(): bool
    {
        return in_array($this->status, ['pending', 'running']);
    }

    public function isCompleted(): bool
    {
        return in_array($this->status, ['success', 'failed', 'cancelled']);
    }

    public function updateStageStatus(string $stageId, string $status, ?string $error = null): void
    {
        $stages = $this->stages_status ?? [];
        $stages[$stageId] = [
            'status' => $status,
            'started_at' => $stages[$stageId]['started_at'] ?? now()->toIso8601String(),
            'finished_at' => in_array($status, ['success', 'failed', 'skipped']) ? now()->toIso8601String() : null,
            'error' => $error,
        ];
        
        $this->update(['stages_status' => $stages]);
    }
}
