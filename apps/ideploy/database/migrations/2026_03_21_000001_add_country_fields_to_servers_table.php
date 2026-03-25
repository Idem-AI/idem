<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            if (! Schema::hasColumn('servers', 'country')) {
                $table->string('country', 100)->nullable()->after('description');
            }
            if (! Schema::hasColumn('servers', 'country_code')) {
                $table->string('country_code', 2)->nullable()->after('country');
            }
            if (! Schema::hasColumn('servers', 'region')) {
                $table->string('region', 100)->nullable()->after('country_code');
            }
            if (! Schema::hasColumn('servers', 'city')) {
                $table->string('city', 100)->nullable()->after('region');
            }
        });
    }

    public function down(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->dropColumnIfExists('country');
            $table->dropColumnIfExists('country_code');
            $table->dropColumnIfExists('region');
            $table->dropColumnIfExists('city');
        });
    }
};
