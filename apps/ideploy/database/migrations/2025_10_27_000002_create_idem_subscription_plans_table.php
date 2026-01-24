<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('idem_subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // free, basic, pro, enterprise
            $table->string('display_name');
            $table->decimal('price', 10, 2)->default(0);
            $table->string('currency')->default('USD');
            $table->enum('billing_period', ['monthly', 'yearly'])->default('monthly');
            $table->integer('app_limit')->default(0)->comment('0 = unlimited');
            $table->integer('server_limit')->default(0)->comment('0 = unlimited');
            $table->text('features')->nullable()->comment('JSON array of features');
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Insert default plans
        DB::table('idem_subscription_plans')->insert([
            [
                'name' => 'free',
                'display_name' => 'Free',
                'price' => 0.00,
                'currency' => 'USD',
                'billing_period' => 'monthly',
                'app_limit' => 2,
                'server_limit' => 2,
                'features' => json_encode([
                    '2 applications gratuites',
                    '2 serveurs personnels',
                    'Déploiement sur infrastructure IDEM',
                    'Support communautaire',
                ]),
                'is_active' => true,
                'sort_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'basic',
                'display_name' => 'Basic',
                'price' => 19.99,
                'currency' => 'USD',
                'billing_period' => 'monthly',
                'app_limit' => 10,
                'server_limit' => 2,
                'features' => json_encode([
                    '10 applications',
                    '2 serveurs personnels',
                    'Déploiement sur infrastructure IDEM',
                    'Support par email',
                ]),
                'is_active' => true,
                'sort_order' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'pro',
                'display_name' => 'Pro',
                'price' => 49.99,
                'currency' => 'USD',
                'billing_period' => 'monthly',
                'app_limit' => 50,
                'server_limit' => 10,
                'features' => json_encode([
                    '50 applications',
                    '10 serveurs personnels',
                    'Déploiement sur infrastructure IDEM',
                    'Support prioritaire',
                    'Analytics avancés',
                ]),
                'is_active' => true,
                'sort_order' => 3,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'enterprise',
                'display_name' => 'Enterprise',
                'price' => 199.99,
                'currency' => 'USD',
                'billing_period' => 'monthly',
                'app_limit' => -1,
                'server_limit' => -1, // unlimited
                'features' => json_encode([
                    'Applications illimitées',
                    'Serveurs personnels illimités',
                    'Déploiement sur infrastructure IDEM',
                    'Support 24/7',
                    'Analytics avancés',
                    'SLA garanti',
                    'Compte manager dédié',
                ]),
                'is_active' => true,
                'sort_order' => 4,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('idem_subscription_plans');
    }
};
