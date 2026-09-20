<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Aligne les plans iDeploy sur le modèle économique IDEM.
 *
 * Trois écarts à corriger, chacun bloquant :
 *
 * **1. Les prix étaient en dollars.** `free/basic/pro/enterprise` à 0/19,99/
 * 49,99/199,99 $ n'ont jamais correspondu à l'offre vendue : Hobby gratuit,
 * Starter 2 999 F, Pro 9 999 F, Scale 24 999 F. Un client qui paie en Mobile
 * Money ne doit pas voir un tarif américain.
 *
 * **2. La colonne du plan était un enum.** Renommer les plans imposait donc
 * une contrainte de base à chaque évolution de l'offre. Elle devient une
 * chaîne : le catalogue vit dans `idem_subscription_plans`, pas dans le type
 * de la colonne.
 *
 * **3. Les limites du modèle n'existaient nulle part.** La table ne connaissait
 * que les applications et les serveurs. Le pool de RAM, le trafic, les bases,
 * les membres, la rétention des logs et les déploiements offerts étaient donc
 * invérifiables — donc jamais appliqués.
 *
 * Les anciens plans ne sont pas supprimés mais désactivés : une équipe qui y
 * était rattachée garde une ligne lisible dans son historique.
 */
return new class extends Migration
{
    /** Correspondance des anciens plans vers les nouveaux, appliquée aux équipes existantes. */
    private const LEGACY_MAP = [
        'free' => 'hobby',
        'basic' => 'starter',
        'pro' => 'pro',
        'enterprise' => 'scale',
    ];

    public function up(): void
    {
        // ── Les limites du modèle économique, colonne par colonne ──────────
        Schema::table('idem_subscription_plans', function (Blueprint $table) {
            if (! Schema::hasColumn('idem_subscription_plans', 'ram_pool_mb')) {
                // 0 = pas de pool partagé : la RAM est allouée par application.
                $table->integer('ram_pool_mb')->default(0)->after('server_limit');
            }
            if (! Schema::hasColumn('idem_subscription_plans', 'ram_per_app_mb')) {
                $table->integer('ram_per_app_mb')->default(512)->after('ram_pool_mb');
            }
            if (! Schema::hasColumn('idem_subscription_plans', 'traffic_gb')) {
                $table->integer('traffic_gb')->default(50)->after('ram_per_app_mb');
            }
            if (! Schema::hasColumn('idem_subscription_plans', 'database_limit')) {
                $table->integer('database_limit')->default(1)->comment('-1 = illimité')->after('traffic_gb');
            }
            if (! Schema::hasColumn('idem_subscription_plans', 'database_storage_gb')) {
                $table->integer('database_storage_gb')->default(1)->after('database_limit');
            }
            if (! Schema::hasColumn('idem_subscription_plans', 'custom_domain_limit')) {
                $table->integer('custom_domain_limit')->default(1)->comment('-1 = illimité (wildcard)')->after('database_storage_gb');
            }
            if (! Schema::hasColumn('idem_subscription_plans', 'member_limit')) {
                $table->integer('member_limit')->default(1)->after('custom_domain_limit');
            }
            if (! Schema::hasColumn('idem_subscription_plans', 'log_retention_days')) {
                // 0 = rétention inférieure au jour (Hobby : une heure).
                $table->integer('log_retention_days')->default(0)->after('member_limit');
            }
            if (! Schema::hasColumn('idem_subscription_plans', 'free_deployments')) {
                // -1 = illimité. Hobby en offre 5 au total, puis chaque
                // déploiement se paie : c'est la marche d'escalier vers
                // l'abonnement, pas une limite technique.
                $table->integer('free_deployments')->default(-1)->after('log_retention_days');
            }
            if (! Schema::hasColumn('idem_subscription_plans', 'extra_deployment_price')) {
                $table->integer('extra_deployment_price')->default(0)->after('free_deployments');
            }
            if (! Schema::hasColumn('idem_subscription_plans', 'always_on')) {
                // Faux : l'application s'endort après 30 min d'inactivité.
                $table->boolean('always_on')->default(true)->after('extra_deployment_price');
            }
            if (! Schema::hasColumn('idem_subscription_plans', 'high_availability')) {
                $table->boolean('high_availability')->default(false)->after('always_on');
            }
        });

        // ── Le plan de l'équipe : d'un enum figé à une chaîne ───────────────
        // Laravel matérialise un enum PostgreSQL par un varchar assorti d'une
        // contrainte CHECK. La lever suffit ; la donnée reste en place.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_idem_subscription_plan_check');
            DB::statement('ALTER TABLE teams ALTER COLUMN idem_subscription_plan TYPE VARCHAR(32)');
            DB::statement("ALTER TABLE teams ALTER COLUMN idem_subscription_plan SET DEFAULT 'hobby'");
        }

        Schema::table('teams', function (Blueprint $table) {
            if (! Schema::hasColumn('teams', 'idem_deploy_credits')) {
                // Crédits de déploiement achetés à l'unité, consommés au-delà
                // des déploiements offerts du plan.
                $table->integer('idem_deploy_credits')->default(0)->after('idem_subscription_plan');
            }
            if (! Schema::hasColumn('teams', 'idem_deployments_used')) {
                $table->integer('idem_deployments_used')->default(0)->after('idem_deploy_credits');
            }
            if (! Schema::hasColumn('teams', 'idem_addons')) {
                // Services managés activés (pare-feu, autoscaling, backups…),
                // facturés par IDEM et synchronisés depuis l'API.
                $table->json('idem_addons')->nullable()->after('idem_deployments_used');
            }
        });

        // ── Le catalogue, aux prix réellement pratiqués ─────────────────────
        foreach ($this->plans() as $plan) {
            $existing = DB::table('idem_subscription_plans')->where('name', $plan['name'])->first();

            if ($existing) {
                DB::table('idem_subscription_plans')
                    ->where('name', $plan['name'])
                    ->update($plan + ['updated_at' => now()]);

                continue;
            }

            DB::table('idem_subscription_plans')->insert(
                $plan + ['created_at' => now(), 'updated_at' => now()]
            );
        }

        // Les anciens plans sortent du catalogue sans disparaître de
        // l'historique : `pro` est conservé, c'est le seul nom commun.
        DB::table('idem_subscription_plans')
            ->whereIn('name', ['free', 'basic', 'enterprise'])
            ->update(['is_active' => false, 'updated_at' => now()]);

        // ── Les équipes suivent leur plan ───────────────────────────────────
        foreach (self::LEGACY_MAP as $from => $to) {
            if ($from === $to) {
                continue;
            }

            DB::table('teams')
                ->where('idem_subscription_plan', $from)
                ->update(['idem_subscription_plan' => $to]);
        }
    }

    public function down(): void
    {
        foreach (self::LEGACY_MAP as $from => $to) {
            if ($from === $to) {
                continue;
            }

            DB::table('teams')
                ->where('idem_subscription_plan', $to)
                ->update(['idem_subscription_plan' => $from]);
        }

        DB::table('idem_subscription_plans')
            ->whereIn('name', ['free', 'basic', 'enterprise'])
            ->update(['is_active' => true, 'updated_at' => now()]);

        DB::table('idem_subscription_plans')
            ->whereIn('name', ['hobby', 'starter', 'scale'])
            ->delete();

        Schema::table('teams', function (Blueprint $table) {
            $table->dropColumn(['idem_deploy_credits', 'idem_deployments_used', 'idem_addons']);
        });

        Schema::table('idem_subscription_plans', function (Blueprint $table) {
            $table->dropColumn([
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
            ]);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE teams ALTER COLUMN idem_subscription_plan SET DEFAULT 'free'");
        }
    }

    /**
     * Les quatre plans du modèle économique, section C.
     *
     * Les prix sont des entiers en francs CFA : la zone franc ne connaît pas
     * de centimes, et arrondir un montant déjà arrondi n'apporte que des
     * écarts d'affichage.
     */
    private function plans(): array
    {
        return [
            [
                'name' => 'hobby',
                'display_name' => 'Hobby',
                'price' => 0,
                'currency' => 'XAF',
                'billing_period' => 'monthly',
                'app_limit' => 2,
                'server_limit' => 1,
                'ram_pool_mb' => 0,
                'ram_per_app_mb' => 512,
                'traffic_gb' => 50,
                'database_limit' => 1,
                'database_storage_gb' => 1,
                'custom_domain_limit' => 1,
                'member_limit' => 1,
                'log_retention_days' => 0,
                'free_deployments' => 5,
                'extra_deployment_price' => 100,
                'always_on' => false,
                'high_availability' => false,
                'features' => json_encode([
                    '2 applications (mise en veille après 30 min d’inactivité)',
                    '5 déploiements offerts, puis 100 F par déploiement',
                    'Domaine monapp.idem.africa gratuit',
                    '1 domaine personnalisé + SSL automatique',
                    '50 GB de trafic sortant par mois',
                    '1 base de données de développement (1 GB)',
                    'Usage commercial autorisé',
                ]),
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'name' => 'starter',
                'display_name' => 'iDeploy Starter',
                'price' => 2999,
                'currency' => 'XAF',
                'billing_period' => 'monthly',
                'app_limit' => 3,
                'server_limit' => 2,
                'ram_pool_mb' => 0,
                'ram_per_app_mb' => 512,
                'traffic_gb' => 100,
                'database_limit' => 1,
                'database_storage_gb' => 2,
                'custom_domain_limit' => 3,
                'member_limit' => 1,
                'log_retention_days' => 7,
                'free_deployments' => -1,
                'extra_deployment_price' => 0,
                'always_on' => true,
                'high_availability' => false,
                'features' => json_encode([
                    '3 applications toujours actives (512 MB chacune)',
                    'Déploiements illimités',
                    '100 GB de trafic sortant par mois',
                    '3 domaines personnalisés + SSL',
                    '1 base persistante (2 GB) + backups hebdomadaires',
                    '2 serveurs BYOS',
                ]),
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'name' => 'pro',
                'display_name' => 'iDeploy Pro',
                'price' => 9999,
                'currency' => 'XAF',
                'billing_period' => 'monthly',
                'app_limit' => 10,
                'server_limit' => 5,
                'ram_pool_mb' => 8192,
                'ram_per_app_mb' => 512,
                'traffic_gb' => 500,
                'database_limit' => 5,
                'database_storage_gb' => 10,
                'custom_domain_limit' => 10,
                'member_limit' => 3,
                'log_retention_days' => 30,
                'free_deployments' => -1,
                'extra_deployment_price' => 0,
                'always_on' => true,
                'high_availability' => false,
                'features' => json_encode([
                    '10 applications, pool de 8 GB de RAM partagée',
                    '500 GB de trafic sortant par mois',
                    '5 bases de données (10 GB) + backups quotidiens',
                    'Monitoring complet + alertes, logs 30 jours',
                    '10 domaines personnalisés, pare-feu avancé',
                    '3 membres d’équipe, 5 serveurs BYOS',
                ]),
                'is_active' => true,
                'sort_order' => 3,
            ],
            [
                'name' => 'scale',
                'display_name' => 'iDeploy Scale',
                'price' => 24999,
                'currency' => 'XAF',
                'billing_period' => 'monthly',
                'app_limit' => 25,
                'server_limit' => -1,
                'ram_pool_mb' => 24576,
                'ram_per_app_mb' => 512,
                'traffic_gb' => 2048,
                'database_limit' => -1,
                'database_storage_gb' => 50,
                'custom_domain_limit' => -1,
                'member_limit' => 10,
                'log_retention_days' => 90,
                'free_deployments' => -1,
                'extra_deployment_price' => 0,
                'always_on' => true,
                'high_availability' => true,
                'features' => json_encode([
                    '25 applications, pool de 24 GB de RAM, 2 TB de trafic',
                    'Haute disponibilité + autoscaling inclus',
                    'Bases illimitées (50 GB) + backups S3 externes',
                    'SLA 99,9 %',
                    'Domaines wildcard, règles de pare-feu personnalisées',
                    '10 membres d’équipe, serveurs BYOS illimités',
                ]),
                'is_active' => true,
                'sort_order' => 4,
            ],
        ];
    }
};
