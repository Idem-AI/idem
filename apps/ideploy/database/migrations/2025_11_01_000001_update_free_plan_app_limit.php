<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('idem_subscription_plans')
            ->where('name', 'free')
            ->update([
                'app_limit' => 5,
                'features' => json_encode([
                    '5 applications gratuites',
                    '2 serveurs personnels',
                    'Déploiement sur infrastructure IDEM',
                    'Support communautaire',
                ]),
                'updated_at' => now(),
            ]);

        // Also update teams currently on free plan that still have old limit of 2
        DB::table('teams')
            ->where('idem_subscription_plan', 'free')
            ->where('idem_app_limit', 2)
            ->update(['idem_app_limit' => 5]);
    }

    public function down(): void
    {
        DB::table('idem_subscription_plans')
            ->where('name', 'free')
            ->update([
                'app_limit' => 2,
                'features' => json_encode([
                    '2 applications gratuites',
                    '2 serveurs personnels',
                    'Déploiement sur infrastructure IDEM',
                    'Support communautaire',
                ]),
                'updated_at' => now(),
            ]);
    }
};
