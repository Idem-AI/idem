<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->boolean('installation_validated')->default(false)->after('traffic_logger_installed');
            $table->timestamp('last_validation_at')->nullable()->after('installation_validated');
            $table->json('validation_details')->nullable()->after('last_validation_at');
        });
    }

    public function down()
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->dropColumn(['installation_validated', 'last_validation_at', 'validation_details']);
        });
    }
};
