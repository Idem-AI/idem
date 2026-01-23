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
        // This migration was created to fix decryption issues
        // All CrowdSec API keys should be stored as plain text
        // for compatibility with Docker labels
        
        // Nothing to do here as the fix was applied directly to accessors
        // in FirewallConfig model
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Nothing to reverse
    }
};
