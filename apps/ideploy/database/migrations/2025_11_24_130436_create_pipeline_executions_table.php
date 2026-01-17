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
        Schema::create('pipeline_executions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('pipeline_config_id')->constrained()->onDelete('cascade');
            $table->foreignId('application_id')->constrained()->onDelete('cascade');
            $table->string('trigger_type')->default('push'); // push, manual, schedule
            $table->string('trigger_user')->nullable();
            $table->string('commit_sha')->nullable();
            $table->string('commit_message')->nullable();
            $table->string('branch')->nullable();
            $table->string('status')->default('pending'); // pending, running, success, failed, cancelled
            $table->json('stages_status')->nullable(); // Status of each stage
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->integer('duration_seconds')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
            
            $table->index(['application_id', 'created_at']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pipeline_executions');
    }
};
