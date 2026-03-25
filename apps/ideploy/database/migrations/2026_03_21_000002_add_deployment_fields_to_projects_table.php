<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (! Schema::hasColumn('projects', 'deployment_type')) {
                $table->string('deployment_type', 10)->default('saas')->after('description');
            }
            if (! Schema::hasColumn('projects', 'deployment_region')) {
                $table->string('deployment_region', 10)->nullable()->after('deployment_type');
            }
            if (! Schema::hasColumn('projects', 'assigned_server_id')) {
                $table->unsignedBigInteger('assigned_server_id')->nullable()->after('deployment_region');
                $table->foreign('assigned_server_id')->references('id')->on('servers')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropForeignIfExists(['assigned_server_id']);
            $table->dropColumnIfExists('deployment_type');
            $table->dropColumnIfExists('deployment_region');
            $table->dropColumnIfExists('assigned_server_id');
        });
    }
};
