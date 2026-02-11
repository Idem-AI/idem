<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class PipelineScanResult extends Model
{
    protected $fillable = [
        'uuid',
        'pipeline_job_id',
        'pipeline_execution_id',
        'tool',
        'status',
        // SonarQube fields
        'sonar_project_key',
        'sonar_task_id',
        'quality_gate_status',
        'bugs',
        'vulnerabilities',
        'code_smells',
        'security_hotspots',
        'coverage',
        'duplications',
        'sonar_dashboard_url',
        // Trivy fields
        'critical_count',
        'high_count',
        'medium_count',
        'low_count',
        'vulnerabilities_detail',
        'secrets_found',
        // Common fields
        'raw_data',
        'summary',
    ];

    protected $casts = [
        'vulnerabilities_detail' => 'array',
        'secrets_found' => 'array',
        'raw_data' => 'array',
        'coverage' => 'decimal:2',
        'duplications' => 'decimal:2',
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

    public function job(): BelongsTo
    {
        return $this->belongsTo(PipelineJob::class, 'pipeline_job_id');
    }

    public function execution(): BelongsTo
    {
        return $this->belongsTo(PipelineExecution::class, 'pipeline_execution_id');
    }

    /**
     * Get total vulnerability count for Trivy
     */
    public function getTotalVulnerabilitiesAttribute(): int
    {
        return ($this->critical_count ?? 0) + 
               ($this->high_count ?? 0) + 
               ($this->medium_count ?? 0) + 
               ($this->low_count ?? 0);
    }

    /**
     * Get SonarQube quality gate status color
     */
    public function getQualityGateColorAttribute(): string
    {
        return match($this->quality_gate_status) {
            'OK' => 'text-green-400',
            'ERROR' => 'text-red-400',
            'WARN' => 'text-yellow-400',
            default => 'text-gray-400'
        };
    }

    /**
     * Get severity color for Trivy
     */
    public function getSeverityColorAttribute(): string
    {
        if ($this->critical_count > 0) {
            return 'text-red-400';
        }
        if ($this->high_count > 0) {
            return 'text-orange-400';
        }
        if ($this->medium_count > 0) {
            return 'text-yellow-400';
        }
        return 'text-green-400';
    }

    /**
     * Check if scan passed
     */
    public function passed(): bool
    {
        if ($this->tool === 'sonarqube') {
            return $this->quality_gate_status === 'OK';
        }
        
        if ($this->tool === 'trivy') {
            // Consider passed if no critical or high vulnerabilities
            return ($this->critical_count ?? 0) === 0 && ($this->high_count ?? 0) === 0;
        }
        
        return $this->status === 'success';
    }
}
