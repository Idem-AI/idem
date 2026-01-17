<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PipelineLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'pipeline_execution_id',
        'stage_id',
        'stage_name',
        'level',
        'message',
        'metadata',
        'logged_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'logged_at' => 'datetime',
    ];

    public function execution(): BelongsTo
    {
        return $this->belongsTo(PipelineExecution::class, 'pipeline_execution_id');
    }
}
