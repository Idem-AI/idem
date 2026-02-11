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
        Schema::create('pipeline_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pipeline_config_id')->constrained()->onDelete('cascade');
            $table->string('channel'); // slack, discord, email
            $table->boolean('enabled')->default(true);
            $table->string('webhook_url')->nullable();
            $table->string('email')->nullable();
            $table->json('events')->nullable(); // success, failure, started
            $table->json('config')->nullable(); // Channel-specific configuration
            $table->timestamps();
            
            $table->index(['pipeline_config_id', 'channel']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pipeline_notifications');
    }
};
