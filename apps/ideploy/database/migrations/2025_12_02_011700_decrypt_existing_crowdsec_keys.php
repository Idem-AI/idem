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
        // This migration handles existing encrypted CrowdSec keys
        // Convert any encrypted keys to plain text
        
        // Nothing to do here as this is handled by model accessors
        // and fresh installs don't have encrypted data
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Nothing to reverse
    }
};
