<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class PipelineJob extends Model
{
    protected $fillable = [
        'uuid',
        'pipeline_execution_id',
        'name',
        'status', // pending, running, success, failed, skipped
        'order',
        'started_at',
        'finished_at',
        'duration_seconds',
        'logs',
        'metadata',
        'error_message',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'metadata' => 'array',
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

    public function execution(): BelongsTo
    {
        return $this->belongsTo(PipelineExecution::class, 'pipeline_execution_id');
    }

    public function scanResults(): HasMany
    {
        return $this->hasMany(PipelineScanResult::class);
    }

    public function getDurationAttribute(): string
    {
        if (!$this->finished_at || !$this->started_at) {
            return '—';
        }
        
        $seconds = $this->finished_at->diffInSeconds($this->started_at);
        return $seconds < 60 ? "{$seconds}s" : floor($seconds/60)."m ".($seconds%60)."s";
    }

    public function getStatusColorAttribute(): string
    {
        return match($this->status) {
            'success' => 'text-green-400 bg-green-500/20',
            'failed' => 'text-red-400 bg-red-500/20',
            'running' => 'text-blue-400 bg-blue-500/20',
            'pending' => 'text-gray-400 bg-gray-500/20',
            default => 'text-gray-400 bg-gray-500/20'
        };
    }

    public function getSonarMetrics(): array
    {
        return $this->report_data['sonar'] ?? [];
    }

    public function getTrivyFindings(): array
    {
        return $this->report_data['trivy'] ?? [];
    }
}
