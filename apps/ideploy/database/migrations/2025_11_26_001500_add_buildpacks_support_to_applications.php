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
        Schema::table('applications', function (Blueprint $table) {
            // Buildpacks configuration
            $table->string('buildpacks_builder')->nullable()->default('paketobuildpacks/builder:base')->after('build_pack')
                ->comment('Cloud Native Buildpacks builder: paketobuildpacks/builder:base, heroku/builder:22, etc.');
            
            $table->text('buildpacks_custom')->nullable()->after('buildpacks_builder')
                ->comment('Comma-separated list of custom buildpacks to use');
            
            $table->boolean('buildpacks_auto_detect')->default(true)->after('buildpacks_custom')
                ->comment('Let buildpacks auto-detect the application type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['buildpacks_builder', 'buildpacks_custom', 'buildpacks_auto_detect']);
        });
    }
};
