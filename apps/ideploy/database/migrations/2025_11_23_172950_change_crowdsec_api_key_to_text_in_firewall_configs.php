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
        Schema::table('firewall_configs', function (Blueprint $table) {
            // Change crowdsec_api_key from string(255) to text (unlimited)
            // to support encrypted keys which are longer than 255 chars
            $table->text('crowdsec_api_key')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('firewall_configs', function (Blueprint $table) {
            $table->string('crowdsec_api_key')->nullable()->change();
        });
    }
};
