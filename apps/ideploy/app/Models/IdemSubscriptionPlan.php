<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class IdemSubscriptionPlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'display_name',
        'price',
        'currency',
        'billing_period',
        'app_limit',
        'server_limit',
        'features',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'app_limit' => 'integer',
        'server_limit' => 'integer',
        'features' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * Check if a plan allows unlimited apps
     */
    public function hasUnlimitedApps(): bool
    {
        return $this->app_limit === -1;
    }

    /**
     * Check if a plan allows unlimited servers
     */
    public function hasUnlimitedServers(): bool
    {
        return $this->server_limit === -1;
    }

    /**
     * Check if a plan is free
     */
    public function isFree(): bool
    {
        return $this->price == 0;
    }

    /**
     * Get formatted price
     */
    public function getFormattedPriceAttribute(): string
    {
        if ($this->isFree()) {
            return 'Gratuit';
        }

        return "$" . number_format($this->price, 2) . '/' . ($this->billing_period === 'monthly' ? 'mois' : 'an');
    }

    /**
     * Get active plans ordered by sort order
     */
    public static function getActivePlans()
    {
        return static::where('is_active', true)
            ->orderBy('sort_order')
            ->get();
    }

    /**
     * Get plan by name
     */
    public static function findByName(string $name)
    {
        return static::where('name', $name)->first();
    }
}
