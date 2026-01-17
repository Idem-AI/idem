<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnalyticsConfig extends Model
{
    protected $fillable = [
        'application_id',
        'provider',
        'enabled',
        'site_id',
        'api_key',
        'api_url',
        'config',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'config' => 'array',
        'api_key' => 'encrypted',
    ];

    protected $hidden = [
        'api_key',
    ];

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }
}
