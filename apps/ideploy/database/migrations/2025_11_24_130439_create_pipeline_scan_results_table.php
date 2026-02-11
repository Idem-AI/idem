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
        Schema::create('pipeline_scan_results', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('pipeline_job_id')->constrained()->onDelete('cascade');
            $table->foreignId('pipeline_execution_id')->constrained()->onDelete('cascade');
            $table->string('tool'); // sonarqube, trivy
            $table->string('status')->default('pending'); // pending, success, failed
            
            // SonarQube specific fields
            $table->string('sonar_project_key')->nullable();
            $table->string('sonar_task_id')->nullable();
            $table->string('quality_gate_status')->nullable(); // OK, ERROR, WARN
            $table->integer('bugs')->nullable();
            $table->integer('vulnerabilities')->nullable();
            $table->integer('code_smells')->nullable();
            $table->integer('security_hotspots')->nullable();
            $table->decimal('coverage', 5, 2)->nullable();
            $table->decimal('duplications', 5, 2)->nullable();
            $table->string('sonar_dashboard_url')->nullable();
            
            // Trivy specific fields
            $table->integer('critical_count')->nullable();
            $table->integer('high_count')->nullable();
            $table->integer('medium_count')->nullable();
            $table->integer('low_count')->nullable();
            $table->json('vulnerabilities_detail')->nullable(); // Detailed vulnerability list
            $table->json('secrets_found')->nullable(); // Exposed secrets
            
            // Common fields
            $table->json('raw_data')->nullable(); // Full API response
            $table->text('summary')->nullable();
            $table->timestamps();
            
            $table->index(['pipeline_execution_id', 'tool']);
            $table->index('pipeline_job_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pipeline_scan_results');
    }
};
