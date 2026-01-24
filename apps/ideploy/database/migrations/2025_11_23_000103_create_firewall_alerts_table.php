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
        Schema::create('firewall_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained()->onDelete('cascade');
            
            // Alert Info
            $table->string('alert_type', 100); // sql_injection, xss, path_traversal, etc.
            $table->string('severity', 50); // low, medium, high, critical
            
            // Source
            $table->ipAddress('ip_address');
            $table->string('scenario')->nullable();
            
            // Details
            $table->text('message')->nullable();
            $table->json('metadata')->nullable();
            
            // Status
            $table->string('status', 50)->default('active'); // active, resolved, false_positive
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->onDelete('set null');
            
            $table->timestamps();
            
            $table->index('application_id');
            $table->index('status');
            $table->index('severity');
            $table->index('ip_address');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('firewall_alerts');
    }
};
