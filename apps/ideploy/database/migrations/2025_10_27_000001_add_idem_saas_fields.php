<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add idem_role to users table for admin/member differentiation
        Schema::table('users', function (Blueprint $table) {
            $table->enum('idem_role', ['admin', 'member'])->default('member')->after('email');
        });

        // Add idem subscription fields to teams table
        Schema::table('teams', function (Blueprint $table) {
            $table->enum('idem_subscription_plan', ['free', 'basic', 'pro', 'enterprise'])->default('free')->after('custom_server_limit');
            $table->integer('idem_app_limit')->default(2)->after('idem_subscription_plan');
            $table->integer('idem_server_limit')->default(0)->after('idem_app_limit');
            $table->integer('idem_apps_count')->default(0)->after('idem_server_limit');
            $table->integer('idem_servers_count')->default(0)->after('idem_apps_count');
            $table->timestamp('idem_subscription_started_at')->nullable()->after('idem_servers_count');
            $table->timestamp('idem_subscription_expires_at')->nullable()->after('idem_subscription_started_at');
        });

        // Add idem_managed flag to servers table to hide managed servers from clients
        Schema::table('servers', function (Blueprint $table) {
            $table->boolean('idem_managed')->default(false)->after('team_id');
            $table->integer('idem_load_score')->default(0)->after('idem_managed')->comment('Load score for server selection strategy');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('idem_role');
        });

        Schema::table('teams', function (Blueprint $table) {
            $table->dropColumn([
                'idem_subscription_plan',
                'idem_app_limit',
                'idem_server_limit',
                'idem_apps_count',
                'idem_servers_count',
                'idem_subscription_started_at',
                'idem_subscription_expires_at',
            ]);
        });

        Schema::table('servers', function (Blueprint $table) {
            $table->dropColumn(['idem_managed', 'idem_load_score']);
        });
    }
};
