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
        // Create IDEM Quotas table
        if (!Schema::hasTable('idem_quotas')) {
            Schema::create('idem_quotas', function (Blueprint $table) {
                $table->id();
                $table->foreignId('team_id')->constrained()->onDelete('cascade');
                $table->string('plan_type')->default('free'); // free, pro, enterprise
                
                // Limits
                $table->integer('max_applications')->default(3);
                $table->integer('max_servers')->default(1);
                $table->integer('max_databases')->default(2);
                $table->integer('max_services')->default(1);
                $table->boolean('unlimited_applications')->default(false);
                $table->boolean('unlimited_servers')->default(false);
                
                // Usage Tracking
                $table->integer('used_applications')->default(0);
                $table->integer('used_servers')->default(0);
                $table->integer('used_databases')->default(0);
                $table->integer('used_services')->default(0);
                
                // Features
                $table->boolean('custom_domains')->default(false);
                $table->boolean('ssl_certificates')->default(false);
                $table->boolean('backup_enabled')->default(false);
                $table->boolean('firewall_enabled')->default(false);
                $table->boolean('analytics_enabled')->default(false);
                
                $table->timestamp('last_sync_at')->nullable();
                $table->timestamps();
                
                $table->index('team_id');
                $table->index('plan_type');
            });
        }

        // Create Pipeline Configs table if not exists
        if (!Schema::hasTable('pipeline_configs')) {
            Schema::create('pipeline_configs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('application_id')->constrained()->onDelete('cascade');
                $table->boolean('enabled')->default(false);
                
                // Pipeline Configuration
                $table->json('stages'); // [{name, tools, order}]
                $table->string('trigger_event')->default('push'); // push, pull_request, manual
                $table->string('branch_filter')->nullable(); // main, develop, feature/*
                
                // Execution Settings
                $table->integer('timeout_minutes')->default(30);
                $table->boolean('parallel_execution')->default(false);
                $table->boolean('auto_rollback')->default(true);
                
                $table->timestamps();
                
                $table->index('application_id');
                $table->index('enabled');
            });
        }

        // Create Pipeline Executions table if not exists
        if (!Schema::hasTable('pipeline_executions')) {
            Schema::create('pipeline_executions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('pipeline_config_id')->constrained()->onDelete('cascade');
                $table->string('execution_id')->unique();
                
                // Execution Details
                $table->string('status')->default('pending'); // pending, running, success, failed, cancelled
                $table->string('trigger_type'); // push, manual, api
                $table->string('commit_hash')->nullable();
                $table->string('branch')->nullable();
                $table->json('triggered_by')->nullable(); // {user_id, user_name}
                
                // Timing
                $table->timestamp('started_at')->nullable();
                $table->timestamp('finished_at')->nullable();
                $table->integer('duration_seconds')->nullable();
                
                // Results
                $table->integer('stages_total')->default(0);
                $table->integer('stages_passed')->default(0);
                $table->integer('stages_failed')->default(0);
                $table->json('stage_results')->nullable(); // [{stage, status, duration, output}]
                
                $table->timestamps();
                
                $table->index('pipeline_config_id');
                $table->index('status');
                $table->index('execution_id');
            });
        }

        // Create Pipeline Logs table if not exists
        if (!Schema::hasTable('pipeline_logs')) {
            Schema::create('pipeline_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('execution_id')->references('id')->on('pipeline_executions')->onDelete('cascade');
                $table->string('stage_name');
                $table->string('tool_name');
                
                // Log Entry
                $table->string('level')->default('info'); // debug, info, warning, error
                $table->text('message');
                $table->json('context')->nullable(); // Additional data
                
                $table->timestamp('logged_at');
                
                $table->index('execution_id');
                $table->index('level');
                $table->index('logged_at');
            });
        }

        // Create Pipeline Tool Configs table if not exists
        if (!Schema::hasTable('pipeline_tool_configs')) {
            Schema::create('pipeline_tool_configs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('pipeline_config_id')->constrained()->onDelete('cascade');
                
                // Tool Information
                $table->string('tool_name'); // eslint, phpstan, tests, deploy
                $table->string('tool_type'); // linter, tests, security, deploy
                $table->integer('stage_order')->default(1);
                
                // Configuration
                $table->json('tool_config'); // Tool-specific configuration
                $table->boolean('enabled')->default(true);
                $table->boolean('required')->default(false); // Block pipeline if fails
                
                // Execution Settings
                $table->integer('timeout_minutes')->default(10);
                $table->integer('retry_count')->default(0);
                
                $table->timestamps();
                
                $table->index('pipeline_config_id');
                $table->index('tool_name');
                $table->index('enabled');
            });
        }

        // Create Analytics Configs table if not exists
        if (!Schema::hasTable('analytics_configs')) {
            Schema::create('analytics_configs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('application_id')->constrained()->onDelete('cascade');
                $table->boolean('enabled')->default(false);
                
                // Analytics Settings
                $table->boolean('track_pageviews')->default(true);
                $table->boolean('track_events')->default(true);
                $table->boolean('track_performance')->default(false);
                $table->boolean('track_errors')->default(true);
                
                // Data Retention
                $table->integer('retention_days')->default(90);
                $table->boolean('gdpr_compliant')->default(true);
                $table->boolean('anonymize_ips')->default(true);
                
                // Integration
                $table->string('google_analytics_id')->nullable();
                $table->string('plausible_domain')->nullable();
                $table->json('custom_events')->nullable(); // [{name, description}]
                
                $table->timestamps();
                
                $table->index('application_id');
                $table->index('enabled');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('analytics_configs');
        Schema::dropIfExists('pipeline_tool_configs');
        Schema::dropIfExists('pipeline_logs');
        Schema::dropIfExists('pipeline_executions');
        Schema::dropIfExists('pipeline_configs');
        Schema::dropIfExists('idem_quotas');
    }
};
