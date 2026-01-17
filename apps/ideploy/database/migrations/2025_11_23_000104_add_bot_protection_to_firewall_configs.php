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
        Schema::table('firewall_configs', function (Blueprint $table) {
            $table->boolean('bot_protection_enabled')->default(false)->after('enabled');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('firewall_configs', function (Blueprint $table) {
            $table->dropColumn('bot_protection_enabled');
        });
    }
};
