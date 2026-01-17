<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PipelineToolConfig extends Model
{
    protected $fillable = [
        'tool_name',
        'type',
        'application_id',
        'enabled',
        'endpoint_url',
        'api_key',
        'config',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'config' => 'array',
    ];

    protected $hidden = [
        'api_key',
    ];

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }
}
