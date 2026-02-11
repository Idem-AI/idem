<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FirewallRule extends Model
{
    protected $fillable = [
        'firewall_config_id',
        'name',
        'description',
        'enabled',
        'priority',
        'rule_type',
        'protection_mode',
        'capacity',
        'leakspeed',
        'conditions',
        'logical_operator',
        'action',
        'remediation_duration',
        'generated_yaml',
        'match_count',
        'last_match_at',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'priority' => 'integer',
        'capacity' => 'integer',
        'conditions' => 'array',
        'remediation_duration' => 'integer',
        'match_count' => 'integer',
        'last_match_at' => 'datetime',
    ];

    protected $attributes = [
        'logical_operator' => 'AND',
        'enabled' => true,
    ];

    /**
     * Relationships
     */
    public function config(): BelongsTo
    {
        return $this->belongsTo(FirewallConfig::class, 'firewall_config_id');
    }

    public function trafficLogs(): HasMany
    {
        return $this->hasMany(FirewallTrafficLog::class, 'rule_id');
    }

    /**
     * Scopes
     */
    public function scopeEnabled($query)
    {
        return $query->where('enabled', true);
    }

    public function scopeInband($query)
    {
        return $query->where('rule_type', 'inband');
    }

    public function scopeOutofband($query)
    {
        return $query->where('rule_type', 'outofband');
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('priority')->orderBy('created_at');
    }

    /**
     * Helpers
     */
    public function incrementMatchCount(): void
    {
        $this->increment('match_count');
        $this->update(['last_match_at' => now()]);
    }

    public function getYamlRuleNameAttribute(): string
    {
        return 'custom_' . str_replace([' ', '-'], '_', strtolower($this->name));
    }

    // Observers are registered in FirewallRuleObserver.php
    // No need for booted() method here
}
