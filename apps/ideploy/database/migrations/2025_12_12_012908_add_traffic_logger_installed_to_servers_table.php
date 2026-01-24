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
        Schema::table('servers', function (Blueprint $table) {
            // Traffic Logger Configuration
            if (!Schema::hasColumn('servers', 'traffic_logger_url')) {
                $table->string('traffic_logger_url')->nullable()->after('crowdsec_bouncer_key');
            }
            if (!Schema::hasColumn('servers', 'traffic_logger_token')) {
                $table->text('traffic_logger_token')->nullable()->after('traffic_logger_url');
            }
            
            // Server Validation Status
            if (!Schema::hasColumn('servers', 'installation_validated')) {
                $table->boolean('installation_validated')->default(false)->after('traefik_logging_enabled');
            }
            if (!Schema::hasColumn('servers', 'last_validation_at')) {
                $table->timestamp('last_validation_at')->nullable()->after('installation_validated');
            }
            if (!Schema::hasColumn('servers', 'validation_details')) {
                $table->json('validation_details')->nullable()->after('last_validation_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->dropColumn([
                'traffic_logger_url',
                'traffic_logger_token', 
                'installation_validated',
                'last_validation_at',
                'validation_details'
            ]);
        });
    }
};
