<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pipeline_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('pipeline_logs', 'created_at')) {
                $table->timestamps();
            }
        });
    }

    public function down(): void
    {
        Schema::table('pipeline_logs', function (Blueprint $table) {
            $table->dropTimestamps();
        });
    }
};
