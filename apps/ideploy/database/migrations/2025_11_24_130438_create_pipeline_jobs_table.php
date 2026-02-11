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
        Schema::create('pipeline_jobs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('pipeline_execution_id')->constrained()->onDelete('cascade');
            $table->string('name'); // language_detection, sonarqube, trivy, deploy
            $table->string('status')->default('pending'); // pending, running, success, failed, skipped
            $table->integer('order')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->integer('duration_seconds')->nullable();
            $table->longText('logs')->nullable();
            $table->json('metadata')->nullable(); // Additional job-specific data
            $table->text('error_message')->nullable();
            $table->timestamps();
            
            $table->index(['pipeline_execution_id', 'order']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pipeline_jobs');
    }
};
