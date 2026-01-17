<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FirewallTrafficLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'application_id',
        'ip_address',
        'method',
        'uri',
        'host',
        'user_agent',
        'referer',
        'decision',
        'rule_id',
        'rule_name',
        'country_code',
        'asn',
        'reverse_dns',
        'timestamp',
    ];

    protected $casts = [
        'timestamp' => 'datetime',
        'application_id' => 'integer',
        'rule_id' => 'integer',
        'asn' => 'integer',
    ];

    /**
     * Relationships
     */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(FirewallRule::class, 'rule_id');
    }

    /**
     * Scopes
     */
    public function scopeBlocked($query)
    {
        return $query->where('decision', 'block');
    }

    public function scopeAllowed($query)
    {
        return $query->where('decision', 'allow');
    }

    public function scopeRecent($query, int $hours = 24)
    {
        return $query->where('timestamp', '>=', now()->subHours($hours));
    }

    public function scopeByIp($query, string $ip)
    {
        return $query->where('ip_address', $ip);
    }

    /**
     * Helpers
     */
    public function isBlocked(): bool
    {
        return $this->decision === 'block';
    }

    public function getDecisionBadgeColorAttribute(): string
    {
        return match($this->decision) {
            'block' => 'red',
            'allow' => 'green',
            'captcha' => 'yellow',
            default => 'gray',
        };
    }
}
