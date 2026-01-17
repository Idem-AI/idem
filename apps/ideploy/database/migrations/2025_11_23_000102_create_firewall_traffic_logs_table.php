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
        Schema::create('firewall_traffic_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained()->onDelete('cascade');
            
            // Request Info
            $table->ipAddress('ip_address');
            $table->string('method', 10)->nullable();
            $table->text('uri')->nullable();
            $table->string('host')->nullable();
            $table->text('user_agent')->nullable();
            $table->text('referer')->nullable();
            
            // CrowdSec Decision
            $table->string('decision', 50)->nullable(); // allow, block, captcha
            $table->foreignId('rule_id')->nullable()->constrained('firewall_rules')->onDelete('set null');
            $table->string('rule_name')->nullable();
            
            // Metadata
            $table->string('country_code', 2)->nullable();
            $table->integer('asn')->nullable();
            $table->string('reverse_dns')->nullable();
            
            // Timestamp
            $table->timestamp('timestamp')->useCurrent();
            
            $table->index('application_id');
            $table->index('ip_address');
            $table->index('decision');
            $table->index('timestamp');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('firewall_traffic_logs');
    }
};
