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
        Schema::table('firewall_rules', function (Blueprint $table) {
            // Add protection_mode column
            // - 'path_only': Block path immediately via AppSec rule (no IP ban)
            // - 'ip_ban': Ban IP after threshold via Scenario (CrowdSec leaky bucket)
            // - 'hybrid': Both - block path + ban IP on abuse (Vercel-style)
            $table->string('protection_mode', 20)->default('hybrid')->after('rule_type');
            
            // Leaky bucket configuration for ip_ban and hybrid modes
            $table->integer('capacity')->default(1)->after('protection_mode'); // How many hits before overflow
            $table->string('leakspeed', 20)->default('10s')->after('capacity'); // Time window
            
            // Add index for performance
            $table->index('protection_mode');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('firewall_rules', function (Blueprint $table) {
            $table->dropIndex(['protection_mode']);
            $table->dropColumn(['protection_mode', 'capacity', 'leakspeed']);
        });
    }
};
