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
        Schema::create('analytics_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained()->onDelete('cascade');
            $table->string('provider')->default('plausible'); // plausible, umami, matomo
            $table->boolean('enabled')->default(false);
            $table->string('site_id')->nullable();
            $table->text('api_key')->nullable();
            $table->string('api_url')->nullable();
            $table->json('config')->nullable();
            $table->timestamps();
            
            $table->index('application_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('analytics_configs');
    }
};
