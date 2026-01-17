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
        Schema::create('pipeline_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pipeline_execution_id')->constrained()->onDelete('cascade');
            $table->string('stage_id'); // Which stage this log belongs to
            $table->string('stage_name');
            $table->string('level')->default('info'); // info, warning, error, success
            $table->text('message');
            $table->json('metadata')->nullable();
            $table->timestamp('logged_at');
            
            $table->index(['pipeline_execution_id', 'logged_at']);
            $table->index('stage_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pipeline_logs');
    }
};
