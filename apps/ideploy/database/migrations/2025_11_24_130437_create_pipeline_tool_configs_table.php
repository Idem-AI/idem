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
        Schema::create('pipeline_tool_configs', function (Blueprint $table) {
            $table->id();
            $table->string('tool_name')->unique(); // sonarqube, trivy, etc.
            $table->string('type'); // global, application
            $table->foreignId('application_id')->nullable()->constrained()->onDelete('cascade');
            $table->boolean('enabled')->default(true);
            $table->string('endpoint_url')->nullable();
            $table->string('api_key')->nullable();
            $table->json('config')->nullable(); // Tool-specific configuration
            $table->timestamps();
            
            $table->index(['tool_name', 'application_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pipeline_tool_configs');
    }
};
