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
        Schema::create('firewall_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('firewall_config_id')->constrained()->onDelete('cascade');
            
            // Rule Identity
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('enabled')->default(true);
            $table->integer('priority')->default(100); // Lower = higher priority
            
            // Rule Type
            $table->string('rule_type', 50)->default('inband'); // inband, outofband
            
            // Conditions (JSON)
            $table->json('conditions'); // [{"field": "request_path", "operator": "equals", "value": "/admin"}]
            $table->string('logical_operator', 10)->default('AND'); // AND, OR
            
            // Action
            $table->string('action', 50)->default('block'); // block, log, captcha, allow
            $table->integer('remediation_duration')->default(3600);
            
            // Generated Rule (YAML)
            $table->text('generated_yaml')->nullable();
            
            // Statistics
            $table->bigInteger('match_count')->default(0);
            $table->timestamp('last_match_at')->nullable();
            
            $table->timestamps();
            
            $table->index('firewall_config_id');
            $table->index('enabled');
            $table->index('priority');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('firewall_rules');
    }
};
