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
            // Load score for server distribution (0-100)
            if (!Schema::hasColumn('servers', 'idem_load_score')) {
                $table->integer('idem_load_score')->default(0)->after('id');
            }
            
            // Indicates if server is managed by IDEM platform
            if (!Schema::hasColumn('servers', 'idem_managed')) {
                $table->boolean('idem_managed')->default(false)->after('idem_load_score');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->dropColumn(['idem_load_score', 'idem_managed']);
        });
    }
};
