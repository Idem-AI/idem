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
        Schema::create('pipeline_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained()->onDelete('cascade');
            $table->boolean('enabled')->default(false);
            $table->json('stages')->nullable(); // Array of stage configurations
            $table->string('trigger_mode')->default('auto'); // auto, manual
            $table->json('trigger_branches')->nullable(); // Branches to trigger on
            $table->json('environment_vars')->nullable(); // Global env vars for pipeline
            $table->timestamps();
            
            $table->index('application_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pipeline_configs');
    }
};
