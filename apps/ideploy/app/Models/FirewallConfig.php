<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Crypt;

class FirewallConfig extends Model
{
    protected $fillable = [
        'application_id',
        'enabled',
        'bot_protection_enabled',
        'crowdsec_api_key',
        'crowdsec_lapi_url',
        'appsec_enabled',
        'inband_enabled',
        'outofband_enabled',
        'default_remediation',
        'ban_duration',
        'blocked_http_code',
        'passed_http_code',
        'total_requests',
        'total_blocked',
        'total_allowed',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'bot_protection_enabled' => 'boolean',
        'appsec_enabled' => 'boolean',
        'inband_enabled' => 'boolean',
        'outofband_enabled' => 'boolean',
        'ban_duration' => 'integer',
        'blocked_http_code' => 'integer',
        'passed_http_code' => 'integer',
        'total_requests' => 'integer',
        'total_blocked' => 'integer',
        'total_allowed' => 'integer',
    ];

    protected $hidden = [
        'crowdsec_api_key',
    ];

    /**
     * Relationships
     */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function rules(): HasMany
    {
        return $this->hasMany(FirewallRule::class);
    }

    public function trafficLogs(): HasMany
    {
        return $this->hasMany(FirewallTrafficLog::class, 'application_id', 'application_id');
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(FirewallAlert::class, 'application_id', 'application_id');
    }

    /**
     * Accessors & Mutators
     * 
     * IMPORTANT: CrowdSec API key is stored PLAIN TEXT in DB for direct use in Docker labels
     * Previous encrypted version caused authentication issues with CrowdSec LAPI
     */
    public function getCrowdsecApiKeyAttribute($value)
    {
        // Plain text for Docker labels
        return $value;
    }

    public function setCrowdsecApiKeyAttribute($value)
    {
        // Plain text for Docker labels
        $this->attributes['crowdsec_api_key'] = $value;
    }

    /**
     * Scopes
     */
    public function scopeEnabled($query)
    {
        return $query->where('enabled', true);
    }

    /**
     * Helpers
     */
    public function getBlockRateAttribute(): float
    {
        if ($this->total_requests === 0) {
            return 0.0;
        }
        
        return round(($this->total_blocked / $this->total_requests) * 100, 2);
    }

    public function incrementStats(string $decision): void
    {
        $this->increment('total_requests');
        
        if ($decision === 'block') {
            $this->increment('total_blocked');
        } else {
            $this->increment('total_allowed');
        }
    }

    /**
     * Get traffic statistics from logs
     */
    public function getTrafficStats(): array
    {
        $logs = $this->trafficLogs()
            ->where('timestamp', '>=', now()->subHours(24))
            ->get();

        $allowed = $logs->where('decision', 'allow')->count();
        $denied = $logs->where('decision', 'ban')->count();
        $challenged = $logs->where('decision', 'captcha')->count();
        $total = $logs->count();

        return [
            'all_traffic' => $total,
            'allowed_requests' => $allowed,
            'denied_requests' => $denied,
            'challenged_requests' => $challenged,
            'block_rate' => $total > 0 ? round(($denied / $total) * 100, 2) : 0,
        ];
    }
}
