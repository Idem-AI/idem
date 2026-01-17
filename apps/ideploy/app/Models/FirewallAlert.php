<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FirewallAlert extends Model
{
    protected $fillable = [
        'application_id',
        'alert_type',
        'severity',
        'ip_address',
        'scenario',
        'message',
        'metadata',
        'status',
        'resolved_at',
        'resolved_by',
    ];

    protected $casts = [
        'metadata' => 'array',
        'resolved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relationships
     */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /**
     * Scopes
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeResolved($query)
    {
        return $query->where('status', 'resolved');
    }

    public function scopeCritical($query)
    {
        return $query->where('severity', 'critical');
    }

    public function scopeHigh($query)
    {
        return $query->where('severity', 'high');
    }

    /**
     * Helpers
     */
    public function resolve(User $user): void
    {
        $this->update([
            'status' => 'resolved',
            'resolved_at' => now(),
            'resolved_by' => $user->id,
        ]);
    }

    public function markAsFalsePositive(User $user): void
    {
        $this->update([
            'status' => 'false_positive',
            'resolved_at' => now(),
            'resolved_by' => $user->id,
        ]);
    }

    public function getSeverityColorAttribute(): string
    {
        return match($this->severity) {
            'critical' => 'red',
            'high' => 'orange',
            'medium' => 'yellow',
            'low' => 'blue',
            default => 'gray',
        };
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
