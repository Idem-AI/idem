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
        'ram_pool_mb',
        'ram_per_app_mb',
        'traffic_gb',
        'database_limit',
        'database_storage_gb',
        'custom_domain_limit',
        'member_limit',
        'log_retention_days',
        'free_deployments',
        'extra_deployment_price',
        'always_on',
        'high_availability',
        'features',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'app_limit' => 'integer',
        'server_limit' => 'integer',
        'ram_pool_mb' => 'integer',
        'ram_per_app_mb' => 'integer',
        'traffic_gb' => 'integer',
        'database_limit' => 'integer',
        'database_storage_gb' => 'integer',
        'custom_domain_limit' => 'integer',
        'member_limit' => 'integer',
        'log_retention_days' => 'integer',
        'free_deployments' => 'integer',
        'extra_deployment_price' => 'integer',
        'always_on' => 'boolean',
        'high_availability' => 'boolean',
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
     * Prix affiché, dans la devise du plan.
     *
     * Les plans IDEM sont libellés en francs CFA : les afficher en dollars
     * donnait un tarif que personne ne paie. La zone franc n'a pas de
     * centimes, d'où l'entier ; le dollar garde ses décimales pour les plans
     * hérités que l'on n'a pas encore migrés.
     */
    public function getFormattedPriceAttribute(): string
    {
        if ($this->isFree()) {
            return 'Gratuit';
        }

        $period = $this->billing_period === 'monthly' ? 'mois' : 'an';

        if (($this->currency ?? 'XAF') === 'XAF') {
            return number_format((float) $this->price, 0, ',', ' ') . ' F/' . $period;
        }

        return '$' . number_format((float) $this->price, 2) . '/' . $period;
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
