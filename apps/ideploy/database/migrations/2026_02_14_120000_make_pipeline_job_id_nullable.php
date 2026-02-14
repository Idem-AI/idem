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
        Schema::table('pipeline_scan_results', function (Blueprint $table) {
            // Make pipeline_job_id nullable since it's not always available
            $table->foreignId('pipeline_job_id')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pipeline_scan_results', function (Blueprint $table) {
            // Revert to NOT NULL (only if no null values exist)
            $table->foreignId('pipeline_job_id')->nullable(false)->change();
        });
    }
};
