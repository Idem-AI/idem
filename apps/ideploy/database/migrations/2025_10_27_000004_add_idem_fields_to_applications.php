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
        Schema::table('applications', function (Blueprint $table) {
            // Indique si l'app est déployée sur IDEM SaaS (serveurs gérés) ou serveurs personnels
            $table->boolean('idem_deploy_on_managed')->default(true)->after('updated_at')
                ->comment('True = deploy on IDEM managed servers, False = deploy on personal servers');
            
            // Serveur IDEM assigné (si deploy_on_managed = true)
            $table->unsignedBigInteger('idem_assigned_server_id')->nullable()->after('idem_deploy_on_managed')
                ->comment('ID of the IDEM managed server assigned to this application');
            
            // Stratégie de sélection du serveur IDEM
            $table->enum('idem_server_strategy', ['least_loaded', 'round_robin', 'random'])
                ->default('least_loaded')->after('idem_assigned_server_id')
                ->comment('Strategy for selecting IDEM managed server');
            
            // Index pour performance
            $table->index('idem_deploy_on_managed');
            $table->index('idem_assigned_server_id');
            
            // Foreign key vers servers (optionnel, pour l'intégrité)
            $table->foreign('idem_assigned_server_id')
                ->references('id')->on('servers')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropForeign(['idem_assigned_server_id']);
            $table->dropIndex(['idem_deploy_on_managed']);
            $table->dropIndex(['idem_assigned_server_id']);
            $table->dropColumn([
                'idem_deploy_on_managed',
                'idem_assigned_server_id',
                'idem_server_strategy'
            ]);
        });
    }
};
