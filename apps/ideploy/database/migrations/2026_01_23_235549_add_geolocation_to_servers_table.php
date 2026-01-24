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
            // Géolocalisation
            $table->string('country')->nullable()->after('idem_managed'); // Pays (ex: "Cameroon", "Senegal")
            $table->string('country_code', 2)->nullable()->after('country'); // Code ISO (ex: "CM", "SN")
            $table->string('region')->nullable()->after('country_code'); // Région (ex: "West Africa", "Central Africa")
            $table->string('city')->nullable()->after('region'); // Ville (ex: "Douala", "Dakar")
            $table->decimal('latitude', 10, 8)->nullable()->after('city'); // Latitude
            $table->decimal('longitude', 11, 8)->nullable()->after('latitude'); // Longitude
            
            // Spécifications serveur (pour l'algorithme de scheduling)
            $table->integer('cpu_cores')->nullable()->after('longitude'); // Nombre de CPU cores
            $table->integer('ram_mb')->nullable()->after('cpu_cores'); // RAM en MB
            $table->integer('disk_gb')->nullable()->after('ram_mb'); // Disque en GB
            $table->integer('max_applications')->default(50)->after('disk_gb'); // Limite d'apps par serveur
            $table->integer('current_applications')->default(0)->after('max_applications'); // Apps actuellement déployées
            
            // Statut et disponibilité
            $table->boolean('is_available')->default(true)->after('current_applications'); // Serveur disponible pour nouveaux déploiements
            $table->integer('load_score')->default(0)->after('is_available'); // Score de charge (0-100)
            
            // Index pour optimiser les requêtes
            $table->index(['country_code', 'is_available']);
            $table->index(['region', 'is_available']);
            $table->index(['idem_managed', 'is_available']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->dropIndex(['country_code', 'is_available']);
            $table->dropIndex(['region', 'is_available']);
            $table->dropIndex(['idem_managed', 'is_available']);
            
            $table->dropColumn([
                'country',
                'country_code',
                'region',
                'city',
                'latitude',
                'longitude',
                'cpu_cores',
                'ram_mb',
                'disk_gb',
                'max_applications',
                'current_applications',
                'is_available',
                'load_score',
            ]);
        });
    }
};
