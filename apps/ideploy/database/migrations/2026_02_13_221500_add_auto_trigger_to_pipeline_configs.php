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
        Schema::table('pipeline_configs', function (Blueprint $table) {
            $table->boolean('auto_trigger_on_push')->default(false)->after('enabled');
            $table->boolean('auto_trigger_on_pr')->default(false)->after('auto_trigger_on_push');
            $table->json('watch_paths')->nullable()->after('auto_trigger_on_pr');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pipeline_configs', function (Blueprint $table) {
            $table->dropColumn(['auto_trigger_on_push', 'auto_trigger_on_pr', 'watch_paths']);
        });
    }
};
