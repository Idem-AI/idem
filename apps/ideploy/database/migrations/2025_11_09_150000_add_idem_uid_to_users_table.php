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
        Schema::table('users', function (Blueprint $table) {
            // Add idem_uid column to store Firebase UID from IDEM API
            $table->string('idem_uid')->nullable()->unique()->after('id');
            
            // Make password nullable since authentication is now handled by IDEM API
            $table->string('password')->nullable()->change();
            
            // Add index for faster lookups
            $table->index('idem_uid');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['idem_uid']);
            $table->dropColumn('idem_uid');
            
            // Restore password as required
            $table->string('password')->nullable(false)->change();
        });
    }
};
