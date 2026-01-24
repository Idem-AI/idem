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
        Schema::table('servers', function (Blueprint $table) {
            $table->boolean('crowdsec_installed')->default(false)->after('settings_id');
            $table->boolean('crowdsec_available')->default(false)->after('crowdsec_installed');
            $table->string('crowdsec_lapi_url')->nullable()->after('crowdsec_available');
            $table->text('crowdsec_api_key')->nullable()->after('crowdsec_lapi_url');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->dropColumn([
                'crowdsec_installed',
                'crowdsec_available',
                'crowdsec_lapi_url',
                'crowdsec_api_key',
            ]);
        });
    }
};
