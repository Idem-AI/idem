<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pipeline_executions', function (Blueprint $table) {
            $table->decimal('duration_seconds', 10, 2)->nullable()->change();
        });
        
        Schema::table('pipeline_jobs', function (Blueprint $table) {
            $table->decimal('duration_seconds', 10, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('pipeline_executions', function (Blueprint $table) {
            $table->integer('duration_seconds')->nullable()->change();
        });
        
        Schema::table('pipeline_jobs', function (Blueprint $table) {
            $table->integer('duration_seconds')->nullable()->change();
        });
    }
};
