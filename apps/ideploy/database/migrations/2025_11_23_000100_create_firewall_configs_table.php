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
        Schema::create('firewall_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained()->onDelete('cascade');
            $table->boolean('enabled')->default(false);
            
            // CrowdSec Configuration
            $table->string('crowdsec_api_key')->nullable();
            $table->string('crowdsec_lapi_url')->nullable();
            
            // AppSec Settings
            $table->boolean('appsec_enabled')->default(true);
            $table->boolean('inband_enabled')->default(true);
            $table->boolean('outofband_enabled')->default(false);
            
            // Remediation Settings
            $table->string('default_remediation', 50)->default('ban'); // ban, captcha, log
            $table->integer('ban_duration')->default(3600); // seconds
            
            // HTTP Response Codes
            $table->integer('blocked_http_code')->default(403);
            $table->integer('passed_http_code')->default(200);
            
            // Statistics
            $table->bigInteger('total_requests')->default(0);
            $table->bigInteger('total_blocked')->default(0);
            $table->bigInteger('total_allowed')->default(0);
            
            $table->timestamps();
            
            $table->index('application_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('firewall_configs');
    }
};
